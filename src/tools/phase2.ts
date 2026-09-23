// Phase 2 tools: real web research. The searching and page reading are Anthropic server tools
// (web_search / web_fetch, declared in llm/claude.ts); this file holds the client tool through
// which the agent turns what it read into a structured, source-backed market observation.

import { BUSINESS_MODELS, type BusinessModel, type MarketObservation } from "../types.js";
import type { ToolDef } from "./types.js";
import { marketKey, normalizeNiche } from "../sim/market.js";
import { clamp } from "../util.js";

/** Canonical form used to compare cited URLs with the URLs the web tools actually returned. */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (p.startsWith("utm_")) u.searchParams.delete(p);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return null;
  }
}

/** Walk any server-tool result block and collect every URL it contains. */
export function collectUrls(block: unknown, into: Set<string>): void {
  if (Array.isArray(block)) {
    for (const b of block) collectUrls(b, into);
    return;
  }
  if (!block || typeof block !== "object") return;
  for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
    if (k === "url" && typeof v === "string") {
      const n = normalizeUrl(v);
      if (n) into.add(n);
    } else if (typeof v === "object") collectUrls(v, into);
  }
}

export const phase2Tools: ToolDef[] = [
  {
    name: "record_market_observation",
    description:
      "Save what you learned about ONE market from the real web: demand and competition on a 0-1 scale, the typical price customers pay, " +
      "a short evidence summary, and the URLs you actually opened or found in search results this cycle (at least one; invented or unseen URLs are rejected). " +
      "Be conservative: base the indices on evidence (search results, competitor offers, prices, reviews, marketplace listings), not on hope.",
    input_schema: {
      type: "object",
      properties: {
        business_model: { type: "string", enum: [...BUSINESS_MODELS] },
        niche: { type: "string", description: "Customer segment, e.g. 'palestre a Milano', 'e-commerce shopify'." },
        demand_index: { type: "number", description: "0 = nobody looks for / pays for this, 1 = strong, visible, paying demand." },
        competition_index: { type: "number", description: "0 = almost no offers, 1 = saturated with established competitors." },
        typical_price: { type: "number", description: "Typical price in EUR per sale seen on the web for comparable offers." },
        evidence: { type: "string", description: "2-5 sentences: what you found, with concrete facts (competitors, prices, signals)." },
        sources: { type: "array", items: { type: "string" }, description: "URLs retrieved this cycle that support the observation." },
      },
      required: ["business_model", "niche", "demand_index", "competition_index", "typical_price", "evidence", "sources"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 2,
    research: true,
    run(ctx, input) {
      if (ctx.brain !== "llm") throw new Error("web observations require the LLM brain with web tools");
      const model = String(input.business_model);
      if (!(BUSINESS_MODELS as readonly string[]).includes(model)) throw new Error(`unknown business_model "${model}"`);
      const niche = String(input.niche ?? "").trim();
      if (!niche) throw new Error('"niche" is required');
      const evidence = String(input.evidence ?? "").trim();
      if (evidence.length < 20) throw new Error('"evidence" must summarise what you found');
      const price = Number(input.typical_price);
      if (!(price > 0 && price <= 5000)) throw new Error('"typical_price" must be in (0, 5000]');

      const cited = Array.isArray(input.sources) ? input.sources.filter((s): s is string => typeof s === "string") : [];
      const verified = cited.filter((u) => {
        const n = normalizeUrl(u);
        return n !== null && ctx.webSources.has(n);
      });
      if (verified.length === 0)
        throw new Error("none of the cited sources was returned by web_search/web_fetch in this cycle: search first, then cite real URLs");

      const obs: MarketObservation = {
        key: marketKey(model as BusinessModel, niche),
        business_model: model as BusinessModel,
        niche: normalizeNiche(niche),
        observed_at: ctx.now,
        demand_index: Math.round(clamp(Number(input.demand_index), 0, 1) * 100) / 100,
        competition_index: Math.round(clamp(Number(input.competition_index), 0, 1) * 100) / 100,
        typical_price: Math.round(price),
        notes: evidence.slice(0, 800),
        source: "web",
        sources: verified.slice(0, 8),
      };
      ctx.agent.memory.observations[obs.key] = obs;

      // The first web observation of a market anchors the simulated world (see sim/market.ts).
      const anchors = (ctx.state.global.market_anchors ??= {});
      if (!anchors[obs.key])
        anchors[obs.key] = {
          demand_index: obs.demand_index,
          competition_index: obs.competition_index,
          typical_price: obs.typical_price,
          recorded_at: ctx.now,
          agent_id: ctx.agent.id,
        };
      ctx.log("web_observation", `${obs.key}: domanda ${obs.demand_index}, concorrenza ${obs.competition_index}, €${obs.typical_price}`, {
        observation: obs,
        rejected_sources: cited.length - verified.length,
      });
      return { saved: obs.key, verified_sources: verified.length, rejected_sources: cited.length - verified.length };
    },
  },
];
