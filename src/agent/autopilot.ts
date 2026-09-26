// Autopilot: deterministic, zero-cost routine decisions taken every cycle before the brain.
//
// The Monte Carlo study (scripts/montecarlo.ts) showed that almost all of the gap between an
// average strategist and a perfect one comes from *exploiting* a market once it is proven: the
// oracle simply keeps re-running its best market. That does not need an LLM. The autopilot:
//   1. renews a profitable experiment as soon as it ends (same market, channel and price),
//      scaling the budget up when the return was strong;
//   2. stops a running experiment that has used half its time with no sale at all.
// Every action still goes through the decision engine and its limits. The (paid) brain is then
// only woken for what needs judgement: finding new markets and handling failures.

import type { Config } from "../config.js";
import type { Agent, Experiment, State } from "../types.js";
import { evaluate, runningExperiments, type Proposal } from "../decision/engine.js";
import { completeExperiment, createExperiment } from "./experiments.js";
import { experimentProfit } from "./memory.js";
import { marketKey } from "../sim/market.js";
import { money } from "../util.js";

/** Minimum return on spend for an experiment to be renewed automatically. */
const RENEW_MIN_ROI = 0.2;
/**
 * Sales needed in a market before renewing it: one lucky high-ticket sale is not evidence
 * (the study showed renewing on a single sale mostly chases luck).
 */
const RENEW_MIN_SALES = Number(process.env.AUTOPILOT_MIN_SALES ?? 2);
/** Return above which the renewal budget is scaled up (x1.5, within the engine's limits). */
const SCALE_UP_ROI = 1;

export interface AutopilotReport {
  renewed: Experiment[];
  stopped: Experiment[];
  notes: string[];
}

export function runAutopilot(state: State, agent: Agent, cfg: Config, completed: Experiment[], now: string): AutopilotReport {
  const report: AutopilotReport = { renewed: [], stopped: [], notes: [] };
  if (!cfg.autopilot) return report;

  // 1. Stop clear losers: half the planned time gone, money spent, not a single sale.
  for (const e of runningExperiments(state, agent.id)) {
    if (e.ticks_elapsed >= e.duration_ticks / 2 && e.conversions === 0 && e.spent > 1) {
      completeExperiment(agent, e, now, "fermato dall'autopilota: metà durata senza vendite");
      report.stopped.push(e);
      report.notes.push(`autopilota: fermato ${e.id} (${e.business_model} → ${e.niche}), metà durata senza vendite, risparmiati €${money(e.budget - e.spent)}`);
    }
  }

  // 2. Renew winners, best return first.
  const winners = completed
    .filter((e) => e.status === "COMPLETED" && experimentProfit(e) > 0 && experimentProfit(e) / Math.max(1, e.spent) >= RENEW_MIN_ROI)
    .sort((a, b) => experimentProfit(b) / Math.max(1, b.spent) - experimentProfit(a) / Math.max(1, a.spent));
  for (const e of winners) {
    const renewed = renew(state, agent, cfg, e, now);
    if (renewed) {
      report.renewed.push(renewed);
      report.notes.push(
        `autopilota: rinnovato ${e.id} → ${renewed.id} (${e.business_model} → ${e.niche} via ${e.channel}, budget €${renewed.budget}, profitto precedente €${experimentProfit(e)})`,
      );
    }
  }
  return report;
}

function renew(state: State, agent: Agent, cfg: Config, e: Experiment, now: string): Experiment | null {
  const key = marketKey(e.business_model, e.niche);
  if ((agent.memory.stats[key]?.conversions ?? e.conversions) < RENEW_MIN_SALES) return null;
  if (runningExperiments(state, agent.id).some((r) => marketKey(r.business_model, r.niche) === key && r.channel === e.channel)) return null;
  const roi = experimentProfit(e) / Math.max(1, e.spent);
  const stats = agent.memory.stats[key];
  const netRevenue = money(e.revenue - e.fulfillment_costs);
  const budgets = roi >= SCALE_UP_ROI ? [money(Math.max(e.budget, 1) * 1.5), e.budget] : [e.budget];
  for (const budget of budgets) {
    const proposal: Proposal = {
      business_model: e.business_model,
      niche: e.niche,
      offer: e.offer,
      channel: e.channel,
      price: e.price,
      budget,
      duration_ticks: e.duration_ticks,
      hypothesis: `Rinnovo automatico di ${e.id}: profitto €${experimentProfit(e)} con ROI ${roi.toFixed(2)}.`,
      estimates: {
        // Track record of this exact market; the engine blends it with history anyway.
        p_success: stats && stats.experiments > 0 ? stats.successes / stats.experiments : 0.5,
        expected_revenue: money(netRevenue * (budget / Math.max(e.budget, 0.01)) ** 0.5),
        risk: "low",
      },
    };
    const decision = evaluate(state, agent, proposal, cfg, now);
    // Renewals never ask for human approval: anything above the threshold is left to the brain.
    if (decision.approved && !decision.requires_human_approval) return createExperiment(state, agent, proposal, decision, now);
  }
  return null;
}
