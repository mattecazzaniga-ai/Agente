// Phase 3 tools: real digital products. The agent decides what to sell (from its web research),
// the worker model writes the product and the page copy, and two gated steps make it real:
//   create_payment_link  – a Stripe payment link on the operator's account   (approval / trust)
//   publish_product      – the page goes live on GitHub Pages                 (approval / trust)
// Gated tools queue an Approval; after TRUST_AUTO_AFTER consecutive approvals they run directly.

import { randomBytes } from "node:crypto";
import path from "node:path";
import type { LandingCopy, Product } from "../types.js";
import type { ToolContext, ToolDef } from "./types.js";
import { policyCheck } from "../safety/guard.js";
import { runWorker } from "../real/worker.js";
import { productDir, readFileSafe, siteDir, slugify, writeFileSafe } from "../real/workspace.js";
import { missingSellerInfo, renderDelivery, renderIndex, renderLanding, sanitizeHtml } from "../real/pages.js";
import { createPaymentLink } from "../real/stripe.js";
import { normalizeNiche } from "../sim/market.js";
import { money, pad } from "../util.js";

/** Products not yet live that one agent may hold at once (avoids burning tokens on drafts). */
const MAX_UNPUBLISHED = 3;

function products(ctx: ToolContext): Record<string, Product> {
  return (ctx.state.products ??= {});
}

function ownProduct(ctx: ToolContext, id: unknown): Product {
  const p = typeof id === "string" ? products(ctx)[id] : undefined;
  if (!p || p.agent_id !== ctx.agent.id) throw new Error(`no product "${String(id)}" of yours`);
  return p;
}

function text(input: Record<string, unknown>, k: string, max = 400): string {
  const v = input[k];
  if (typeof v !== "string" || !v.trim()) throw new Error(`"${k}" must be a non-empty string`);
  return v.trim().slice(0, max);
}

function strings(input: Record<string, unknown>, k: string, maxItems: number): string[] {
  const v = input[k];
  if (!Array.isArray(v)) throw new Error(`"${k}" must be an array of strings`);
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300));
  if (!out.length) throw new Error(`"${k}" must not be empty`);
  return out.slice(0, maxItems);
}

const LANDING_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    subheadline: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    for_who: { type: "string" },
    whats_inside: { type: "array", items: { type: "string" } },
    faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"], additionalProperties: false } },
    cta: { type: "string" },
  },
  required: ["headline", "subheadline", "bullets", "for_who", "whats_inside", "faq", "cta"],
  additionalProperties: false,
};

const WRITER_SYSTEM =
  "Sei un autore esperto di prodotti digitali pratici (guide, template, checklist, toolkit). Scrivi contenuti originali, concreti e " +
  "immediatamente utilizzabili, senza riempitivi. Niente promesse di guadagno, niente contenuti copiati, niente dati personali di terzi, " +
  "niente consigli medici, legali o finanziari personalizzati. Rispondi SOLO con il corpo HTML del prodotto usando esclusivamente i tag " +
  "h1, h2, h3, p, ul, ol, li, strong, em, blockquote, table, thead, tbody, tr, th, td, hr, code, pre: nessun attributo, nessun link, nessuno script.";

const COPY_SYSTEM =
  "Sei un copywriter onesto. Scrivi il testo di una pagina di vendita chiara e persuasiva per un prodotto digitale. Descrivi SOLO ciò che " +
  "il prodotto contiene davvero. Vietati: superlativi non dimostrabili, finte scarsità o conti alla rovescia, recensioni inventate, promesse " +
  "di guadagno o risultati garantiti. Tono diretto, dai del tu.";

export const phase3Tools: ToolDef[] = [
  {
    name: "create_product",
    description:
      "Create a REAL digital product (guide, template, checklist, toolkit…) for a niche you have researched on the web. The worker model writes the " +
      "full content into your workspace. Costs LLM budget (~$0.05–0.15). Nothing is published yet.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        niche: { type: "string", description: "Customer segment; must match a niche you researched on the web." },
        format: { type: "string", enum: ["guide", "template", "checklist", "toolkit", "swipe_file", "workbook"] },
        audience: { type: "string", description: "Who buys it and what problem it solves for them." },
        language: { type: "string", enum: ["it", "en", "es", "fr", "de"] },
        price_eur: { type: "number", description: "3–200 EUR, coherent with the prices you saw on the web." },
        outline: { type: "array", items: { type: "string" }, description: "Sections the product must contain (4–12)." },
        rationale: { type: "string", description: "Why people will pay for this, based on your research." },
      },
      required: ["title", "niche", "format", "audience", "language", "price_eur", "outline", "rationale"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 3,
    async run(ctx, input) {
      const title = text(input, "title", 120);
      const niche = normalizeNiche(text(input, "niche", 120));
      const audience = text(input, "audience", 400);
      const outline = strings(input, "outline", 12);
      const policy = policyCheck(title, audience, outline.join(" "), String(input.rationale ?? ""));
      if (!policy.ok) throw new Error(policy.reason!);
      if (ctx.brain === "llm" && !Object.values(ctx.agent.memory.observations).some((o) => o.source === "web" && o.niche === niche))
        throw new Error(`no web observation for niche "${niche}": research it first (record_market_observation)`);
      const unpublished = Object.values(products(ctx)).filter((p) => p.agent_id === ctx.agent.id && p.status !== "LIVE" && p.status !== "RETIRED");
      if (unpublished.length >= MAX_UNPUBLISHED) throw new Error(`you already have ${unpublished.length} unpublished products: finish or retire them first`);
      const price = Number(input.price_eur);
      if (!(price >= 3 && price <= 200)) throw new Error("price_eur must be between 3 and 200");

      const seq = (ctx.state.global.next_product_seq ??= 1);
      ctx.state.global.next_product_seq = seq + 1;
      const id = `prod-${pad(seq, 4)}`;
      const language = String(input.language ?? "it");
      const html = await runWorker(ctx, {
        system: WRITER_SYSTEM,
        prompt:
          `Scrivi il prodotto completo in lingua "${language}".\nTitolo: ${title}\nFormato: ${String(input.format)}\nPubblico: ${audience}\n` +
          `Sezioni obbligatorie:\n${outline.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nDeve valere il prezzo di €${price}: esempi concreti, passi pratici, modelli pronti da copiare.`,
        maxTokens: 16000,
        estimateUsd: 0.15,
      });
      const clean = sanitizeHtml(html);
      if (clean.replace(/<[^>]+>/g, "").trim().length < 800) throw new Error("the generated product is too short to sell: retry with a richer outline");
      const file = path.join(productDir(ctx.cfg.dataDir, id), "product.html");
      await writeFileSafe(file, clean);
      const product: Product = {
        id,
        agent_id: ctx.agent.id,
        slug: `${slugify(title)}-${seq}`,
        title,
        niche,
        format: String(input.format),
        audience,
        language,
        price_eur: money(price),
        status: "DRAFT",
        created_at: ctx.now,
        files: ["product.html"],
        delivery_token: randomBytes(12).toString("hex"),
        sales: 0,
        revenue_eur: 0,
      };
      products(ctx)[id] = product;
      ctx.log("product_created", `${id} "${title}" (€${product.price_eur}, ${niche})`, { rationale: input.rationale });
      return { product_id: id, status: product.status, characters: clean.length, next: "write_landing_copy" };
    },
  },
  {
    name: "write_landing_copy",
    description: "Write the sales page copy for one of your products (worker model, structured). Required before payment link and publishing.",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "string" }, angle: { type: "string", description: "The main benefit / hook to lead with, from your research." } },
      required: ["product_id", "angle"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 3,
    async run(ctx, input) {
      const p = ownProduct(ctx, input.product_id);
      if (p.status === "LIVE" || p.status === "RETIRED") throw new Error(`product is ${p.status}`);
      const content = await readFileSafe(path.join(productDir(ctx.cfg.dataDir, p.id), "product.html"));
      const raw = await runWorker(ctx, {
        system: COPY_SYSTEM,
        prompt:
          `Prodotto: ${p.title} (${p.format}), prezzo €${p.price_eur}, lingua "${p.language}".\nPubblico: ${p.audience}\nAngolo principale: ${text(input, "angle", 300)}\n\n` +
          `Contenuto reale del prodotto (estratto):\n${content.replace(/<[^>]+>/g, " ").slice(0, 6000)}\n\n` +
          "Restituisci: headline (max 70 caratteri), subheadline (max 160), 3-5 bullets di benefici, for_who, whats_inside (4-8 voci), 3-5 faq, cta (max 30 caratteri).",
        maxTokens: 4000,
        schema: LANDING_SCHEMA,
        estimateUsd: 0.03,
      });
      const copy = JSON.parse(raw) as LandingCopy;
      const policy = policyCheck(copy.headline, copy.subheadline, copy.bullets.join(" "));
      if (!policy.ok) throw new Error(policy.reason!);
      p.landing_copy = copy;
      if (p.status === "DRAFT") p.status = "PAGE_READY";
      return { product_id: p.id, status: p.status, headline: copy.headline, next: "create_payment_link" };
    },
  },
  {
    name: "create_payment_link",
    description:
      "Create a Stripe payment link for a product (real money will be collected on the operator's account). Needs human approval until trust is earned.",
    input_schema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"], additionalProperties: false },
    permission: "approval",
    phase: 3,
    summarize: (ctx, input) => {
      const p = products(ctx)[String(input.product_id)];
      return p ? `Creare il link di pagamento Stripe per ${p.id} "${p.title}" a €${p.price_eur}` : `Creare un link di pagamento per ${String(input.product_id)}`;
    },
    async run(ctx, input) {
      const p = ownProduct(ctx, input.product_id);
      if (p.status !== "PAGE_READY") throw new Error(`product must be PAGE_READY (is ${p.status}): write the landing copy first`);
      const missing = missingSellerInfo(ctx.cfg);
      if (!ctx.cfg.real.stripeKey) missing.push("STRIPE_SECRET_KEY");
      if (missing.length) throw new Error(`operator setup missing: ${missing.join(", ")} (see docs/SETUP.md)`);
      const link = await createPaymentLink(ctx.cfg.real.stripeKey!, {
        name: p.title,
        description: p.landing_copy?.subheadline ?? p.audience,
        amountCents: Math.round(p.price_eur * 100),
        currency: ctx.cfg.real.currency,
        redirectUrl: `${ctx.cfg.real.siteBaseUrl}/${p.slug}/${p.delivery_token}/`,
        metadata: { agent_product: p.id, agent: p.agent_id },
      });
      p.stripe = link;
      p.status = "PAYMENT_READY";
      ctx.log("payment_link_created", `${p.id}: ${link.payment_link_url}`);
      return { product_id: p.id, status: p.status, payment_link: link.payment_link_url, next: "publish_product" };
    },
  },
  {
    name: "publish_product",
    description: "Publish the product's sales page on the public site (GitHub Pages). Needs human approval until trust is earned.",
    input_schema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"], additionalProperties: false },
    permission: "approval",
    phase: 3,
    summarize: (ctx, input) => {
      const p = products(ctx)[String(input.product_id)];
      return p ? `Pubblicare online la pagina di vendita di ${p.id} "${p.title}" (€${p.price_eur})` : `Pubblicare ${String(input.product_id)}`;
    },
    async run(ctx, input) {
      const p = ownProduct(ctx, input.product_id);
      if (p.status !== "PAYMENT_READY" || !p.stripe || !p.landing_copy) throw new Error(`product must be PAYMENT_READY (is ${p.status})`);
      const missing = missingSellerInfo(ctx.cfg);
      if (missing.length) throw new Error(`operator setup missing: ${missing.join(", ")}`);
      const content = await readFileSafe(path.join(productDir(ctx.cfg.dataDir, p.id), "product.html"));
      const site = siteDir(ctx.cfg.dataDir);
      await writeFileSafe(path.join(site, p.slug, "index.html"), renderLanding(ctx.cfg, p, p.landing_copy, p.stripe.payment_link_url));
      await writeFileSafe(path.join(site, p.slug, p.delivery_token, "index.html"), renderDelivery(ctx.cfg, p, content));
      p.status = "LIVE";
      p.published_at = ctx.now;
      p.page_url = `${ctx.cfg.real.siteBaseUrl}/${p.slug}/`;
      p.last_sales_check = Math.floor(Date.parse(ctx.now) / 1000) - 60;
      await writeFileSafe(path.join(site, "index.html"), renderIndex(ctx.cfg, Object.values(products(ctx))));
      ctx.log("product_published", `${p.id} live: ${p.page_url}`);
      return { product_id: p.id, status: p.status, url: p.page_url };
    },
  },
  {
    name: "retire_product",
    description: "Stop selling a product that does not sell or that you no longer want (removes it from the site index; the page stays reachable by existing buyers).",
    input_schema: { type: "object", properties: { product_id: { type: "string" }, reason: { type: "string" } }, required: ["product_id", "reason"], additionalProperties: false },
    permission: "auto",
    phase: 3,
    async run(ctx, input) {
      const p = ownProduct(ctx, input.product_id);
      p.status = "RETIRED";
      if (ctx.cfg.real.siteBaseUrl) await writeFileSafe(path.join(siteDir(ctx.cfg.dataDir), "index.html"), renderIndex(ctx.cfg, Object.values(products(ctx))));
      ctx.log("product_retired", `${p.id}: ${text(input, "reason")}`);
      return { product_id: p.id, status: p.status };
    },
  },
];

/** Compact view of the agent's real products for the briefing. */
export function productsSnapshot(state: ToolContext["state"], agentId: string, now: string): string {
  const mine = Object.values(state.products ?? {}).filter((p) => p.agent_id === agentId);
  if (!mine.length) return "(nessun prodotto reale ancora)";
  return mine
    .map(
      (p) =>
        `- ${p.id} [${p.status}] "${p.title}" · ${p.niche} · €${p.price_eur} · vendite ${p.sales} · incasso netto €${money(p.revenue_eur)}` +
        (p.page_url ? ` · ${p.page_url}` : "") +
        (p.published_at ? ` · online da ${Math.round((Date.parse(now) - Date.parse(p.published_at)) / 86_400_000)} g` : ""),
    )
    .join("\n");
}

