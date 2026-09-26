// The operating cycle. One call to runTick() = one autonomous cycle for every ACTIVE agent:
//
//   guard → MEASURE (advance running experiments, book money) → LEARN (auto lessons, stats)
//         → RESEARCH/ANALYZE/PLAN/ACT (brain + tools, through the decision engine)
//         → account LLM cost → death / reproduction checks → persist
//
// The scheduler (GitHub Actions cron) calls this every hour; nothing here waits for a human.

import type { Config } from "../config.js";
import type { Agent, LogEvent, State } from "../types.js";
import type { Store } from "../store/store.js";
import type { ToolContext } from "../tools/types.js";
import { canTick, launchesToday, llmBudgetAvailable, llmSpentToday } from "../safety/guard.js";
import { committedCapital, runningExperiments } from "../decision/engine.js";
import { advanceExperiments } from "./experiments.js";
import { experimentProfit } from "./memory.js";
import { runAutopilot } from "./autopilot.js";
import { briefing } from "./prompt.js";
import { HeuristicBrain, type Brain } from "./brain.js";
import { book, canReproduce, checkDeath, createAgent, reproduce } from "../economy/lifecycle.js";
import { day, hash, money, rng } from "../util.js";

export interface TickOptions {
  now?: string;
  /** Brain to use when the LLM is available. Defaults to HeuristicBrain. */
  brain?: Brain;
  /** Ignore the per-agent rate limit (manual runs). Kill switches still apply. */
  force?: boolean;
}

export interface AgentTickReport {
  agent_id: string;
  skipped: string | null;
  brain: string | null;
  capital_before: number;
  capital_after: number;
  llm_usd: number;
  summary: string | null;
  events: string[];
}

export function ensureGenesis(state: State, cfg: Config, now: string): Agent | null {
  if (Object.keys(state.agents).length > 0) return null;
  return createAgent(state, { capital: cfg.economy.initialCapital, initialCapital: cfg.economy.initialCapital, parent: null, now });
}

export async function runTick(store: Store, cfg: Config, opts: TickOptions = {}): Promise<AgentTickReport[]> {
  const now = opts.now ?? new Date().toISOString();
  const state = await store.load();
  const events: LogEvent[] = [];
  const emit = (agent_id: string | null, type: string, message: string, data?: unknown) => events.push({ at: now, agent_id, type, message, data });

  const genesis = ensureGenesis(state, cfg, now);
  if (genesis) emit(genesis.id, "agent_created", `${genesis.name} creato con €${genesis.capital}`);

  const reports: AgentTickReport[] = [];
  try {
    for (const agent of Object.values(state.agents)) {
      if (agent.status === "DEAD") continue;
      reports.push(await tickAgent(state, agent, cfg, now, opts, emit));
      await flush(store, state, events);
    }
  } finally {
    await flush(store, state, events);
  }
  return reports;
}

async function flush(store: Store, state: State, events: LogEvent[]): Promise<void> {
  await store.save(state);
  for (const e of events.splice(0)) await store.log(e);
}

async function tickAgent(
  state: State,
  agent: Agent,
  cfg: Config,
  now: string,
  opts: TickOptions,
  emit: (agent_id: string | null, type: string, message: string, data?: unknown) => void,
): Promise<AgentTickReport> {
  const report: AgentTickReport = {
    agent_id: agent.id,
    skipped: null,
    brain: null,
    capital_before: agent.capital,
    capital_after: agent.capital,
    llm_usd: 0,
    summary: null,
    events: [],
  };
  const log = (type: string, message: string, data?: unknown) => {
    emit(agent.id, type, message, data);
    report.events.push(`${type}: ${message}`);
  };

  const verdict = canTick(state, opts.force ? { ...agent, last_tick_at: null } : agent, cfg, now);
  if (!verdict.ok) {
    report.skipped = verdict.reason;
    emit(agent.id, "tick_skipped", verdict.reason!);
    return report;
  }

  const rand = rng(hash(`${state.global.world_seed}:${agent.id}:${agent.tick_count}`));

  // MEASURE + LEARN (factual)
  const measured = advanceExperiments(state, agent, cfg, rand, now);
  for (const line of measured.progressed) log("measure", line);
  const completedNotes = measured.completed.map((e) => {
    const note = `${e.id} CONCLUSO: profitto €${experimentProfit(e)} (${e.conversions} vendite su ${e.visitors} visite, speso €${e.spent}, ricavi €${e.revenue})`;
    log("experiment_completed", note, { experiment: e });
    return note;
  });

  if (checkDeath(state, agent, now)) {
    log("agent_dead", agent.status_reason!);
    return finish(agent, report, now);
  }

  // AUTOPILOT: free routine decisions (renew proven winners, stop clear losers).
  const auto = runAutopilot(state, agent, cfg, measured.completed, now);
  for (const note of auto.notes) {
    log("autopilot", note);
    completedNotes.push(note);
  }

  // THINK + ACT
  const wantsLlm = Boolean(opts.brain && opts.brain.name !== "heuristic");
  if (isDormant(state, agent, cfg)) {
    // Nothing running and no free capital above the reserve: thinking (or researching) would only
    // burn the last euros. Stay alive and wait: reserve money is never spent on LLM calls.
    log("dormant", `free capital at or below the reserve (€${agent.capital}): no thinking, no spending`);
    report.brain = "none (dormant)";
    return finish(agent, report, now);
  }
  if (wantsLlm && !opts.force) {
    // Winners the autopilot already renewed need no LLM decision.
    const why = thinkReason(state, agent, cfg, now, measured.completed.length - auto.renewed.length);
    if (!why) {
      log("think_skipped", "nothing to decide this cycle: measuring only");
      report.brain = "none (nothing to decide)";
      return finish(agent, report, now);
    }
    log("think", `brain invoked: ${why}`);
  }
  const llmOk = wantsLlm && llmBudgetAvailable(state, cfg, now);
  if (wantsLlm && !llmOk) {
    const msg = `LLM daily budget exhausted ($${llmSpentToday(state, now).toFixed(3)} / $${cfg.limits.maxLlmUsdPerDay})`;
    if (cfg.llm.budgetFallback === "measure_only") {
      log("think_skipped", `${msg}: measuring only, no new decisions until the budget resets`);
      report.brain = "none (LLM budget)";
      return finish(agent, report, now);
    }
    log("brain_fallback", `${msg}: using heuristic brain`);
  }
  const brain: Brain = llmOk ? opts.brain! : new HeuristicBrain();
  report.brain = brain.name;
  agent.last_think_at = now;
  const experimentsBefore = Object.keys(state.experiments).length;

  const ctx: ToolContext = {
    state,
    agent,
    cfg,
    now,
    rand,
    counters: newCounters(),
    brain: brain.name === "heuristic" ? "heuristic" : "llm",
    webSources: new Set(),
    log,
    aborted: false,
    cycleEnd: null,
  };
  const remainingUsd = cfg.limits.maxLlmUsdPerDay - llmSpentToday(state, now);
  let active = ctx;
  try {
    await withTimeout(brain.think(ctx, briefing(state, agent, cfg, now, measured.progressed, completedNotes), remainingUsd), cfg.limits.tickTimeoutMs);
  } catch (err) {
    ctx.aborted = true;
    log("brain_error", (err as Error).message);
    if (brain.name !== "heuristic") {
      // Keep the business running even if the API is down.
      active = { ...ctx, aborted: false, cycleEnd: null, counters: newCounters(), brain: "heuristic" };
      await new HeuristicBrain().think(active);
      report.brain = `${brain.name} → heuristic (error)`;
    }
  }

  // Account for the real cost of thinking (including turns made before an error).
  const usd = ctx.counters.llmUsd;
  if (usd > 0) {
    report.llm_usd = usd;
    agent.llm_cost_usd = Math.round((agent.llm_cost_usd + usd) * 1e6) / 1e6;
    const d = day(now);
    state.global.llm_spend_by_day[d] = Math.round(((state.global.llm_spend_by_day[d] ?? 0) + usd) * 1e6) / 1e6;
    if (cfg.economy.chargeLlmCostToCapital) book(agent, 0, money(usd * cfg.economy.usdToEur));
    log("llm_cost", `$${usd.toFixed(4)} this cycle (${ctx.counters.webSearches} web searches, ${ctx.counters.webFetches} page fetches)`);
  }
  if (ctx.counters.webSearches > 0) {
    const d = day(now);
    const byDay = (state.global.web_searches_by_day ??= {});
    byDay[d] = (byDay[d] ?? 0) + ctx.counters.webSearches;
  }

  // Did this wake-up produce anything? Feeds the free-slot back-off in thinkReason().
  agent.idle_thinks = Object.keys(state.experiments).length > experimentsBefore ? 0 : Math.min((agent.idle_thinks ?? 0) + 1, 4);

  const end = active.cycleEnd;
  if (end) {
    report.summary = end.summary;
    agent.next_action = end.next_action;
    agent.last_action = end.summary.slice(0, 200);
    log("cycle_end", end.summary, { next_action: end.next_action });
  }

  if (checkDeath(state, agent, now)) log("agent_dead", agent.status_reason!);
  else if (canReproduce(state, agent, cfg)) {
    const child = reproduce(state, agent, cfg, now);
    if (child) log("agent_reproduced", `${agent.name} ha generato ${child.name} con €${child.capital}: ${child.strategy.thesis.slice(0, 160)}`);
  }
  return finish(agent, report, now);
}

/** No experiment running and less than €1 of free capital above the reserve. */
export function isDormant(state: State, agent: Agent, cfg: Config): boolean {
  if (runningExperiments(state, agent.id).length > 0) return false;
  return agent.capital - committedCapital(state, agent.id) < agent.initial_capital * cfg.limits.reserveFraction + 1;
}

function newCounters(): ToolContext["counters"] {
  return { toolCalls: 0, researchCalls: 0, llmUsd: 0, webSearches: 0, webFetches: 0 };
}

/** Cost control: only wake the (paid) LLM brain when there is a decision to make. */
export function thinkReason(state: State, agent: Agent, cfg: Config, now: string, completed: number): string | null {
  if (completed > 0) return `${completed} experiment(s) completed`;
  if (!agent.last_think_at) return "first cycle";
  const hours = (Date.parse(now) - Date.parse(agent.last_think_at)) / 3_600_000;
  if (hours >= cfg.limits.thinkEveryHours) return `periodic review (${hours.toFixed(1)}h since last)`;
  const freeSlot = runningExperiments(state, agent.id).length < cfg.limits.maxConcurrentExperiments;
  // Back-off: every wake-up that launched nothing doubles the wait (2h → 4h → 8h, capped at the periodic review).
  const wait = Math.min(cfg.limits.thinkWhenIdleSlotHours * 2 ** (agent.idle_thinks ?? 0), cfg.limits.thinkEveryHours);
  if (freeSlot && launchesToday(state, now) < cfg.limits.maxLaunchesPerDay && hours >= wait) return "free experiment slot";
  return null;
}

function finish(agent: Agent, report: AgentTickReport, now: string): AgentTickReport {
  agent.tick_count += 1;
  agent.last_tick_at = now;
  report.capital_after = agent.capital;
  return report;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`cycle timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
