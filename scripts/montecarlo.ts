// Monte Carlo profitability study of the simulated economy.
//
//   npx tsx scripts/montecarlo.ts [worlds=40] [days=60]
//
// For every world (market seed) it runs one agent for `days` of hourly cycles with two brains:
//   heuristic – the offline rule-based brain (a mediocre strategist)
//   oracle    – knows the hidden market parameters (upper bound of what research could achieve)
// and three daily "thinking" overheads, i.e. what the Claude API would cost (charged to capital).

import { loadConfig } from "../src/config.js";
import type { Store } from "../src/store/store.js";
import { emptyState } from "../src/store/store.js";
import type { LogEvent, State, BusinessModel, Channel } from "../src/types.js";
import { BUSINESS_MODELS, CHANNELS } from "../src/types.js";
import { isDormant, runTick } from "../src/agent/loop.js";
import { HeuristicBrain, type Brain, type BrainResult } from "../src/agent/brain.js";
import { executeTool } from "../src/tools/registry.js";
import type { ToolContext } from "../src/tools/types.js";
import { runningExperiments } from "../src/decision/engine.js";
import { book, checkDeath } from "../src/economy/lifecycle.js";
import { hiddenMarket, KNOWN_NICHES, simulateTick, marketKey } from "../src/sim/market.js";
import type { Experiment } from "../src/types.js";
import { money, rng } from "../src/util.js";

class MemStore implements Store {
  constructor(private state: State) {}
  async load() { return this.state; }
  async save(s: State) { this.state = s; }
  async log(_e: LogEvent) {}
  async readLog() { return []; }
}

type Candidate = { model: BusinessModel; niche: string; channel: Channel; price: number; budget: number; duration: number; profit: number };

/** Oracle: ranks every (model, niche, channel) by average simulated profit using the hidden truth. */
function rankMarkets(seed: number, budget: number): Candidate[] {
  const out: Candidate[] = [];
  const rand = rng(seed * 7919);
  for (const model of BUSINESS_MODELS)
    for (const niche of KNOWN_NICHES)
      for (const channel of CHANNELS) {
        const m = hiddenMarket(seed, model, niche);
        const duration = channel === "paid_ads" ? 24 : 48;
        const price = Math.round(m.refPrice);
        let total = 0;
        for (let run = 0; run < 3; run++) {
          const e = { business_model: model, niche, channel, price, budget, duration_ticks: duration, ticks_elapsed: 0, conversions: 0 } as Experiment;
          for (let t = 0; t < duration; t++) {
            const r = simulateTick(seed, e, rand);
            total += r.revenue - r.spent - r.fulfillment_costs;
            e.ticks_elapsed++;
            e.conversions += r.conversions;
          }
        }
        out.push({ model, niche, channel, price, budget, duration, profit: total / 3 });
      }
  return out.sort((a, b) => b.profit - a.profit);
}

class OracleBrain implements Brain {
  // Not named "heuristic", so the loop does not swap it for the rule-based brain. It spends no LLM money.
  readonly name = "oracle";
  private ranking: Candidate[] | null = null;
  constructor(private seed: number) {}
  async think(ctx: ToolContext): Promise<BrainResult> {
    const budget = Math.min(5, money(ctx.agent.capital * 0.1));
    this.ranking ??= rankMarkets(this.seed, 5);
    const running = runningExperiments(ctx.state, ctx.agent.id);
    for (const c of this.ranking.slice(0, 6)) {
      if (runningExperiments(ctx.state, ctx.agent.id).length >= ctx.cfg.limits.maxConcurrentExperiments) break;
      if (c.profit <= 0) break;
      if (running.some((e) => marketKey(e.business_model, e.niche) === marketKey(c.model, c.niche) && e.channel === c.channel)) continue;
      await executeTool(ctx, "launch_experiment", {
        business_model: c.model, niche: c.niche, offer: `offerta ${c.model} per ${c.niche}`, channel: c.channel,
        price: c.price, budget: Math.max(0.5, budget), duration_ticks: c.duration, hypothesis: "oracle",
        p_success: 0.8, expected_revenue: Math.max(1, c.profit + budget), risk: "low",
      });
    }
    await executeTool(ctx, "end_cycle", { summary: "oracle", next_action: "MEASURE" });
    return { usd: 0, turns: 1 };
  }
}

/**
 * Cost model of the Claude brain with the intelligence of the heuristic one: the loop's real gating
 * applies (woken only when there is something to decide, dormant, daily cap) and each wake-up
 * costs `usdPerThink`, charged to capital exactly like a real Claude cycle.
 */
class PaidHeuristicBrain implements Brain {
  readonly name = "claude-like";
  private inner = new HeuristicBrain();
  thinks = 0;
  constructor(private usdPerThink: number) {}
  async think(ctx: ToolContext): Promise<BrainResult> {
    this.thinks++;
    ctx.counters.llmUsd += this.usdPerThink;
    await this.inner.think(ctx);
    return { usd: this.usdPerThink, turns: 1 };
  }
}

type Scenario = { label: string; brain: "heuristic" | "paid" | "oracle"; autopilot: boolean; usdPerThink?: number };
type Result = { final: number; doubledDay: number | null; dead: boolean; llmUsd: number; thinks: number };

async function runWorld(seed: number, days: number, sc: Scenario): Promise<Result> {
  const cfg = loadConfig();
  cfg.llm.enabled = false;
  cfg.autopilot = sc.autopilot;
  // Simulated research everywhere: this study measures decision quality and cost, not web research.
  cfg.phase = 1;
  const state = emptyState(seed);
  const store = new MemStore(state);
  const paid = sc.brain === "paid" ? new PaidHeuristicBrain(sc.usdPerThink ?? 0.15) : null;
  const brain: Brain = sc.brain === "oracle" ? new OracleBrain(seed) : paid ?? new HeuristicBrain();
  const start = Date.UTC(2026, 9, 1);
  let doubledDay: number | null = null;
  for (let i = 0; i < days * 24; i++) {
    // Real gating (think only when needed) for the paid brain; the free brains act every hour.
    await runTick(store, cfg, { brain, now: new Date(start + i * 3_600_000).toISOString(), force: sc.brain !== "paid" });
    const a = Object.values(state.agents)[0]!;
    if (a.status === "DEAD") break;
    if (doubledDay === null && a.capital >= a.initial_capital * 2) doubledDay = Math.floor(i / 24) + 1;
  }
  const a = Object.values(state.agents)[0]!;
  return { final: a.capital, doubledDay, dead: a.status === "DEAD", llmUsd: a.llm_cost_usd, thinks: paid?.thinks ?? 0 };
}

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}

const SCENARIOS: Scenario[] = [
  { label: "euristico, senza autopilota", brain: "heuristic", autopilot: false },
  { label: "euristico + autopilota", brain: "heuristic", autopilot: true },
  { label: "costo Claude, senza autopilota", brain: "paid", autopilot: false },
  { label: "costo Claude + autopilota", brain: "paid", autopilot: true },
  { label: "oracolo (tetto massimo)", brain: "oracle", autopilot: true },
];

async function main() {
  const worlds = Number(process.argv[2] ?? 40);
  const days = Number(process.argv[3] ?? 60);
  const json: Record<string, unknown> = {};
  for (const sc of SCENARIOS) {
    const res: Result[] = [];
    for (let w = 1; w <= worlds; w++) res.push(await runWorld(1000 + w, days, sc));
    const finals = res.map((r) => r.final);
    const doubled = res.filter((r) => r.doubledDay !== null);
    const summary = {
      ...sc,
      median: money(pct(finals, 0.5)),
      mean: money(finals.reduce((x, y) => x + y, 0) / worlds),
      profitable: res.filter((r) => r.final > 50).length / worlds,
      doubled: doubled.length / worlds,
      medianDaysToDouble: doubled.length ? pct(doubled.map((r) => r.doubledDay!), 0.5) : null,
      dead: res.filter((r) => r.dead).length / worlds,
      llmUsdPerDay: money(res.reduce((x, r) => x + r.llmUsd, 0) / worlds / days),
      thinksPerDay: Math.round((res.reduce((x, r) => x + r.thinks, 0) / worlds / days) * 10) / 10,
      finals,
    };
    json[sc.label] = summary;
    console.error(
      `${sc.label.padEnd(32)} | mediana €${summary.median} | media €${summary.mean} | in utile ${(summary.profitable * 100).toFixed(0)}% | raddoppio ${(summary.doubled * 100).toFixed(0)}%` +
        `${summary.medianDaysToDouble ? ` (g.${summary.medianDaysToDouble})` : ""} | morti ${(summary.dead * 100).toFixed(0)}%` +
        (sc.brain === "paid" ? ` | Claude $${summary.llmUsdPerDay}/g, ${summary.thinksPerDay} risvegli/g` : ""),
    );
  }
  console.log(JSON.stringify(json));
}

main();
