// Decision engine: deterministic gate between what the LLM *wants* to do and what is allowed.
// The LLM supplies estimates; the engine corrects them with the agent's own track record,
// computes expected value and worst-case exposure, and applies hard limits.

import type { Config } from "../config.js";
import type { Agent, BusinessModel, Channel, DecisionReport, Experiment, ExperimentEstimates, State } from "../types.js";
import { launchesToday, policyCheck } from "../safety/guard.js";
import { marketKey, operatingCostPerTick } from "../sim/market.js";
import { clamp, money } from "../util.js";

export interface Proposal {
  business_model: BusinessModel;
  niche: string;
  offer: string;
  channel: Channel;
  price: number;
  budget: number;
  duration_ticks: number;
  hypothesis: string;
  estimates: ExperimentEstimates;
}

/** Below this budget an untested market may be probed even with negative EV (information value). */
export const EXPLORATION_BUDGET = 3;

export function runningExperiments(state: State, agentId: string): Experiment[] {
  return Object.values(state.experiments).filter((e) => e.agent_id === agentId && e.status === "RUNNING");
}

/** Capital still committed to running experiments (budget not yet spent). */
export function committedCapital(state: State, agentId: string): number {
  return runningExperiments(state, agentId).reduce((s, e) => s + Math.max(0, e.budget - e.spent), 0);
}

/** Blend the LLM's probability with the agent's historical success rate for this business model. */
export function adjustedProbability(agent: Agent, p: ExperimentEstimates["p_success"], model: BusinessModel, niche: string): number {
  const est = clamp(p, 0, 1);
  const stats = agent.memory.stats[marketKey(model, niche)] ?? agent.memory.stats[model];
  let adj = est;
  if (stats && stats.experiments > 0) {
    const hist = (1 + stats.successes) / (2 + stats.experiments); // Beta(1,1) prior
    const w = stats.experiments / (stats.experiments + 3);
    adj = (1 - w) * est + w * hist;
  }
  // LLMs are systematically overconfident about new ventures: cap untested optimism.
  return clamp(adj, 0.01, 0.8);
}

export interface EvaluateOptions {
  /** Phase 2+ with the LLM brain: the market must have been researched on the real web first. */
  requireWebObservation?: boolean;
}

export function evaluate(state: State, agent: Agent, p: Proposal, cfg: Config, now: string, opts: EvaluateOptions = {}): DecisionReport {
  const L = cfg.limits;
  const reasons: string[] = [];
  let hardFail = false;
  const fail = (r: string) => {
    hardFail = true;
    reasons.push(`REJECT: ${r}`);
  };

  const policy = policyCheck(p.offer, p.hypothesis, p.niche);
  if (!policy.ok) fail(policy.reason!);

  const running = runningExperiments(state, agent.id);
  const committed = committedCapital(state, agent.id);
  const free = agent.capital - committed;
  const reserve = agent.initial_capital * L.reserveFraction;

  if (!(p.budget >= 0)) fail("budget must be >= 0");
  if (!(p.price > 0 && p.price <= 5000)) fail(`price ${p.price} out of range (0, 5000]`);
  if (!Number.isInteger(p.duration_ticks) || p.duration_ticks < 1 || p.duration_ticks > L.maxDurationTicks)
    fail(`duration_ticks must be an integer in [1, ${L.maxDurationTicks}]`);
  if (p.budget > L.maxBudgetPerExperiment) fail(`budget €${p.budget} > max per experiment €${L.maxBudgetPerExperiment}`);
  if (p.budget > agent.capital * L.maxCapitalFractionPerExperiment)
    fail(`budget €${p.budget} > ${L.maxCapitalFractionPerExperiment * 100}% of capital (€${money(agent.capital)})`);
  if (committed + p.budget > agent.capital * L.maxCapitalFractionCommitted)
    fail(`total committed would be €${money(committed + p.budget)} > ${L.maxCapitalFractionCommitted * 100}% of capital`);
  if (running.length >= L.maxConcurrentExperiments) fail(`already ${running.length} running experiments (max ${L.maxConcurrentExperiments})`);
  if (launchesToday(state, now) >= L.maxLaunchesPerDay) fail(`daily launch limit reached (${L.maxLaunchesPerDay})`);
  const key = marketKey(p.business_model, p.niche);
  if (opts.requireWebObservation && agent.memory.observations[key]?.source !== "web")
    fail(`no web observation for ${key}: research it and call record_market_observation first`);
  if (running.some((e) => marketKey(e.business_model, e.niche) === key && e.channel === p.channel))
    fail("an identical experiment (model, niche, channel) is already running");

  const adjusted = adjustedProbability(agent, p.estimates.p_success, p.business_model, p.niche);
  const opCosts = operatingCostPerTick(p.business_model) * (p.duration_ticks || 0);
  const expectedValue = adjusted * Math.max(0, p.estimates.expected_revenue) - p.budget - opCosts;
  const worstCase = p.budget + operatingCostPerTick(p.business_model) * (p.duration_ticks || 0);
  const untested = !agent.memory.stats[key];

  if (free - worstCase < reserve) fail(`would breach reserve: free capital after worst case €${money(free - worstCase)} < €${money(reserve)}`);

  reasons.push(
    `p_success: LLM ${p.estimates.p_success.toFixed(2)} → adjusted ${adjusted.toFixed(2)}; EV = ${adjusted.toFixed(2)} × €${money(
      p.estimates.expected_revenue,
    )} − budget €${money(p.budget)} − costi operativi €${money(opCosts)} = €${money(expectedValue)}`,
  );

  if (expectedValue <= 0) {
    if (untested && p.budget <= EXPLORATION_BUDGET) reasons.push(`ALLOW: negative EV but cheap probe of an untested market (≤ €${EXPLORATION_BUDGET})`);
    else fail("expected value is not positive");
  }
  if (p.estimates.risk === "high" && p.budget > EXPLORATION_BUDGET) fail("high-risk action with non-trivial budget");

  const requiresApproval = !hardFail && p.budget > L.approvalThreshold;
  if (requiresApproval) reasons.push(`NEEDS APPROVAL: budget €${p.budget} > approval threshold €${L.approvalThreshold}`);
  if (!hardFail) reasons.push("OK: within all limits");

  return {
    approved: !hardFail,
    requires_human_approval: requiresApproval,
    expected_value: money(expectedValue),
    adjusted_p_success: Math.round(adjusted * 1000) / 1000,
    worst_case_loss: money(worstCase),
    capital_after_worst_case: money(agent.capital - committed - worstCase),
    reasons,
  };
}
