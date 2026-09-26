// Marketing playbook: conventional, public knowledge about which acquisition channel suits which
// kind of digital business. Given to both brains (Claude reads it in its prompt, the heuristic
// uses it to pick channels) so no one wastes experiments on a channel that rarely fits.

import type { BusinessModel, Channel } from "../types.js";

export const CHANNEL_PLAYBOOK: Record<BusinessModel, { best: Channel[]; why: string }> = {
  micro_service: { best: ["marketplace", "direct_outreach", "community"], why: "servizi piccoli si vendono dove i clienti cercano freelance o con contatto diretto" },
  digital_product: { best: ["marketplace", "content_seo", "community"], why: "prodotti a basso prezzo: servono volumi, marketplace e contenuti" },
  lead_generation: { best: ["direct_outreach", "paid_ads", "content_seo"], why: "B2B: il contatto diretto personalizzato converte meglio" },
  automation_service: { best: ["direct_outreach", "marketplace", "community"], why: "servizio B2B ad alto prezzo: relazione e fiducia prima di tutto" },
  micro_saas: { best: ["content_seo", "community", "paid_ads"], why: "abbonamento a basso prezzo: acquisizione scalabile e contenuti" },
  research_service: { best: ["marketplace", "direct_outreach", "community"], why: "servizio su misura: marketplace e contatto diretto" },
  landing_page_service: { best: ["direct_outreach", "marketplace", "community"], why: "servizio B2B visibile: si mostra a chi ha un sito debole" },
};

export function playbookText(): string {
  return Object.entries(CHANNEL_PLAYBOOK)
    .map(([m, p]) => `- ${m}: ${p.best.join(" > ")} (${p.why})`)
    .join("\n");
}
