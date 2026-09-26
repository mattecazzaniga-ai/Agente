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

type Result = { final: number; peak: number; doubledDay: number | null; dead: boolean };

async function runWorld(seed: number, days: number, brainKind: "heuristic" | "oracle", usdPerDay: number): Promise<Result> {
  const cfg = loadConfig();
  cfg.llm.enabled = false;
  // The oracle already knows the market: no web-research requirement (that is a Phase 2 LLM rule).
  if (brainKind === "oracle") cfg.phase = 1;
  const state = emptyState(seed);
  const store = new MemStore(state);
  const brain: Brain = brainKind === "oracle" ? new OracleBrain(seed) : new HeuristicBrain();
  const start = Date.UTC(2026, 9, 1);
  const overheadPerTick = (usdPerDay * cfg.economy.usdToEur) / 24;
  let peak = cfg.economy.initialCapital;
  let doubledDay: number | null = null;
  for (let i = 0; i < days * 24; i++) {
    await runTick(store, cfg, { brain, now: new Date(start + i * 3_600_000).toISOString(), force: true });
    const a = Object.values(state.agents)[0]!;
    if (a.status === "DEAD") break;
    // LLM cost is only paid while the agent is awake (a dormant agent does not call Claude).
    if (overheadPerTick > 0 && !isDormant(state, a, cfg)) {
      book(a, 0, overheadPerTick);
      checkDeath(state, a, new Date(start + i * 3_600_000).toISOString());
    }
    peak = Math.max(peak, a.capital);
    if (doubledDay === null && a.capital >= a.initial_capital * 2) doubledDay = Math.floor(i / 24) + 1;
  }
  const a = Object.values(state.agents)[0]!;
  return { final: a.capital, peak, doubledDay, dead: a.status === "DEAD" };
}

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}

async function main() {
  const worlds = Number(process.argv[2] ?? 40);
  const days = Number(process.argv[3] ?? 60);
  const rows: string[] = [];
  const json: Record<string, unknown> = {};
  for (const brain of ["heuristic", "oracle"] as const)
    for (const usd of [0, 0.25, 1]) {
      const res: Result[] = [];
      for (let w = 1; w <= worlds; w++) res.push(await runWorld(1000 + w, days, brain, usd));
      const finals = res.map((r) => r.final);
      const doubled = res.filter((r) => r.doubledDay !== null);
      const summary = {
        brain, usdPerDay: usd,
        median: money(pct(finals, 0.5)), p10: money(pct(finals, 0.1)), p90: money(pct(finals, 0.9)),
        profitable: res.filter((r) => r.final > 50).length / worlds,
        doubled: doubled.length / worlds,
        medianDaysToDouble: doubled.length ? pct(doubled.map((r) => r.doubledDay!), 0.5) : null,
        dead: res.filter((r) => r.dead).length / worlds,
        finals,
      };
      json[`${brain}_${usd}`] = summary;
      rows.push(
        `${brain.padEnd(9)} $${usd.toFixed(2)}/g | mediana €${summary.median} (p10 €${summary.p10}, p90 €${summary.p90}) | in utile ${(summary.profitable * 100).toFixed(0)}% | raddoppio ${(summary.doubled * 100).toFixed(0)}%` +
          `${summary.medianDaysToDouble ? ` (mediana giorno ${summary.medianDaysToDouble})` : ""} | morti ${(summary.dead * 100).toFixed(0)}%`,
      );
      console.error(rows[rows.length - 1]);
    }
  console.log(JSON.stringify(json));
}

main();
