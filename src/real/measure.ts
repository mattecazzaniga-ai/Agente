// MEASURE for real products: completed Stripe checkouts since the last check become real revenue.

import type { Config } from "../config.js";
import type { Agent, State } from "../types.js";
import { completedCheckouts } from "./stripe.js";
import { book } from "../economy/lifecycle.js";
import { money } from "../util.js";

export interface SalesReport {
  sales: number;
  netEur: number;
  notes: string[];
}

export async function measureRealSales(state: State, agent: Agent, cfg: Config, now: string): Promise<SalesReport> {
  const report: SalesReport = { sales: 0, netEur: 0, notes: [] };
  const key = cfg.real.stripeKey;
  if (!cfg.real.enabled || !key) return report;
  for (const p of Object.values(state.products ?? {})) {
    if (p.agent_id !== agent.id || !p.stripe || (p.status !== "LIVE" && p.status !== "RETIRED")) continue;
    const since = p.last_sales_check ?? Math.floor(Date.parse(p.published_at ?? now) / 1000);
    try {
      const sessions = await completedCheckouts(key, p.stripe.payment_link_id, since);
      for (const s of sessions) {
        const gross = s.amount_total / 100;
        const net = money(gross - gross * cfg.real.stripeFeePct - cfg.real.stripeFeeFixed);
        p.sales += 1;
        p.revenue_eur = money(p.revenue_eur + net);
        state.global.real_revenue_eur = money((state.global.real_revenue_eur ?? 0) + net);
        book(agent, net, 0);
        report.sales += 1;
        report.netEur = money(report.netEur + net);
        report.notes.push(`VENDITA REALE ${p.id} "${p.title}": €${gross.toFixed(2)} lordi, €${net} netti`);
      }
      if (sessions.length) p.last_sales_check = Math.max(since, ...sessions.map((s) => s.created));
      else p.last_sales_check = Math.max(since, Math.floor(Date.parse(now) / 1000) - 600);
    } catch (err) {
      report.notes.push(`errore lettura vendite ${p.id}: ${(err as Error).message}`);
    }
  }
  return report;
}
