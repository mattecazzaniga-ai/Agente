// Experiment lifecycle: create → (approval) → run → measure each tick → complete → learn.

import type { Config } from "../config.js";
import type { Agent, Approval, DecisionReport, Experiment, State } from "../types.js";
import type { Proposal } from "../decision/engine.js";
import { simulateTick } from "../sim/market.js";
import { book } from "../economy/lifecycle.js";
import { addLesson, experimentProfit, factualLesson, recordOutcome } from "./memory.js";
import { day, money, pad } from "../util.js";

export function createExperiment(state: State, agent: Agent, p: Proposal, decision: DecisionReport, now: string): Experiment {
  const id = `exp-${pad(state.global.next_experiment_seq++, 4)}`;
  const exp: Experiment = {
    id,
    agent_id: agent.id,
    business_model: p.business_model,
    niche: p.niche.trim().toLowerCase(),
    offer: p.offer,
    channel: p.channel,
    price: money(p.price),
    budget: money(p.budget),
    duration_ticks: p.duration_ticks,
    hypothesis: p.hypothesis,
    estimates: p.estimates,
    status: decision.requires_human_approval ? "PENDING_APPROVAL" : "RUNNING",
    created_at: now,
    started_at: decision.requires_human_approval ? null : now,
    ended_at: null,
    ticks_elapsed: 0,
    spent: 0,
    revenue: 0,
    fulfillment_costs: 0,
    visitors: 0,
    conversions: 0,
    decision,
    outcome_note: null,
  };
  state.experiments[id] = exp;
  if (exp.status === "RUNNING") countLaunch(state, now);
  else {
    const approval: Approval = {
      id: `apr-${id}`,
      created_at: now,
      agent_id: agent.id,
      kind: "experiment",
      ref_id: id,
      summary: `${agent.name} vuole lanciare ${id}: ${p.business_model} → ${p.niche} via ${p.channel}, budget €${p.budget}, prezzo €${p.price}. EV €${decision.expected_value}.`,
      status: "PENDING",
      decided_at: null,
    };
    state.approvals[approval.id] = approval;
  }
  return exp;
}

export function countLaunch(state: State, now: string): void {
  const d = day(now);
  state.global.launches_by_day[d] = (state.global.launches_by_day[d] ?? 0) + 1;
}

export interface MeasureReport {
  progressed: string[];
  completed: Experiment[];
}

/** MEASURE step: advance every running experiment of the agent by one tick and book the money. */
export function advanceExperiments(state: State, agent: Agent, cfg: Config, rand: () => number, now: string): MeasureReport {
  const report: MeasureReport = { progressed: [], completed: [] };
  for (const e of Object.values(state.experiments)) {
    if (e.agent_id !== agent.id || e.status !== "RUNNING") continue;
    const r = simulateTick(state.global.world_seed, e, rand);
    // Budget is spread evenly over duration_ticks, so total spend = budget + operating costs.
    const spend = money(r.spent);
    e.ticks_elapsed += 1;
    e.spent = money(e.spent + spend);
    e.revenue = money(e.revenue + r.revenue);
    e.fulfillment_costs = money(e.fulfillment_costs + r.fulfillment_costs);
    e.visitors += r.visitors;
    e.conversions += r.conversions;
    book(agent, money(r.revenue), money(spend + r.fulfillment_costs));
    report.progressed.push(
      `${e.id} tick ${e.ticks_elapsed}/${e.duration_ticks}: +${r.visitors} visite, +${r.conversions} vendite, ricavi €${money(r.revenue)}, costi €${money(spend + r.fulfillment_costs)}`,
    );
    if (e.ticks_elapsed >= e.duration_ticks) {
      completeExperiment(agent, e, now, "durata completata");
      report.completed.push(e);
    }
  }
  return report;
}

/** LEARN step for one experiment. */
export function completeExperiment(agent: Agent, e: Experiment, now: string, note: string): void {
  e.status = "COMPLETED";
  e.ended_at = now;
  e.outcome_note = `${note}; profitto €${experimentProfit(e)}`;
  recordOutcome(agent, e);
  addLesson(agent, factualLesson(e, now));
}
