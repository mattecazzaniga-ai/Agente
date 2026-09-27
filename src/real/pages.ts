// Static pages the agent publishes. Copy comes from the worker model, but the HTML is a fixed,
// script-free template: the model can never inject code, and every page carries the seller's
// identity and the digital-content withdrawal notice required by Italian/EU consumer law.

import type { Config } from "../config.js";
import type { LandingCopy, Product } from "../types.js";
import { escapeHtml as e } from "./workspace.js";

const ALLOWED_TAGS = new Set(["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "code", "pre", "span", "div", "section"]);

/** Keep only harmless formatting tags, drop every attribute (no scripts, links, styles or handlers). */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (tag, name: string) => {
      const n = name.toLowerCase();
      if (!ALLOWED_TAGS.has(n)) return "";
      return tag.startsWith("</") ? `</${n}>` : `<${n}>`;
    });
}

export function missingSellerInfo(cfg: Config): string[] {
  const missing: string[] = [];
  if (!cfg.real.sellerName) missing.push("SELLER_NAME");
  if (!cfg.real.sellerEmail) missing.push("SELLER_EMAIL");
  if (!cfg.real.siteBaseUrl) missing.push("SITE_BASE_URL");
  return missing;
}

const CSS = `:root{--bg:#fbfaf7;--fg:#1c1b19;--muted:#5d5a55;--card:#fff;--line:#e7e3dc;--accent:#1f6f4a;--accent-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--fg:#f1efe9;--muted:#b3afa6;--card:#1d1c1a;--line:#2e2c29;--accent:#4fb485;--accent-fg:#0d1f16}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 16px 64px}h1{font-size:clamp(30px,6vw,46px);line-height:1.1;margin:0 0 16px}
h2{font-size:24px;margin:40px 0 12px}.sub{font-size:20px;color:var(--muted);margin:0 0 28px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;margin:24px 0}
ul{padding-left:22px}li{margin:6px 0}.price{font-size:32px;font-weight:700;margin:0}
.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);text-decoration:none;font-weight:700;padding:16px 28px;border-radius:12px;margin-top:12px}
.btn:focus-visible{outline:3px solid var(--fg);outline-offset:3px}details{border-top:1px solid var(--line);padding:14px 0}summary{cursor:pointer;font-weight:600}
footer{max-width:760px;margin:0 auto;padding:24px 16px 48px;color:var(--muted);font-size:14px;border-top:1px solid var(--line)}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid var(--line);padding:8px;text-align:left}`;

function shell(cfg: Config, title: string, body: string, opts: { noindex?: boolean; description?: string } = {}): string {
  const vat = cfg.real.sellerVat ? ` · P.IVA ${e(cfg.real.sellerVat)}` : "";
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title>${opts.description ? `<meta name="description" content="${e(opts.description)}">` : ""}
${opts.noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}<style>${CSS}</style></head>
<body><main>${body}</main>
<footer>Venditore: ${e(cfg.real.sellerName ?? "")} · <a href="mailto:${e(cfg.real.sellerEmail ?? "")}">${e(cfg.real.sellerEmail ?? "")}</a>${vat}<br>
Prodotto digitale consegnato subito dopo il pagamento. Con l'acquisto acconsenti all'esecuzione immediata e prendi atto che perdi il diritto di recesso (art. 59, c. 1, lett. o, Codice del Consumo). Pagamenti gestiti da Stripe: i dati della carta non passano da questo sito. Per assistenza scrivi all'indirizzo sopra.</footer>
</body></html>`;
}

export function renderLanding(cfg: Config, p: Product, copy: LandingCopy, paymentUrl: string): string {
  const price = p.price_eur.toFixed(2).replace(".", ",");
  const body = `<h1>${e(copy.headline)}</h1><p class="sub">${e(copy.subheadline)}</p>
<ul>${copy.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
<div class="card"><p class="price">€${price}</p><a class="btn" href="${e(paymentUrl)}">${e(copy.cta)}</a></div>
<h2>Per chi è</h2><p>${e(copy.for_who)}</p>
<h2>Cosa ricevi</h2><ul>${copy.whats_inside.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
<h2>Domande frequenti</h2>${copy.faq.map((f) => `<details><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join("")}
<div class="card"><p class="price">€${price}</p><a class="btn" href="${e(paymentUrl)}">${e(copy.cta)}</a></div>`;
  return shell(cfg, `${copy.headline} — ${p.title}`, body, { description: copy.subheadline });
}

export function renderDelivery(cfg: Config, p: Product, productHtml: string): string {
  const body = `<p class="sub">Grazie per l'acquisto! Ecco il tuo prodotto. Salva questa pagina nei preferiti o stampala in PDF (Ctrl/Cmd+P).</p>
<div class="card">${sanitizeHtml(productHtml)}</div>`;
  return shell(cfg, p.title, body, { noindex: true });
}

export function renderIndex(cfg: Config, products: Product[]): string {
  const items = products
    .filter((p) => p.status === "LIVE")
    .map((p) => `<li><a href="./${e(p.slug)}/">${e(p.title)}</a> — €${p.price_eur.toFixed(2).replace(".", ",")}</li>`)
    .join("");
  return shell(cfg, "Prodotti digitali", `<h1>Prodotti digitali</h1><ul>${items || "<li>In arrivo.</li>"}</ul>`);
}
