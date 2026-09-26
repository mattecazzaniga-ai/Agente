// Brain = the component that decides what to do in a cycle, by calling tools.
// ClaudeBrain (src/llm/claude.ts) is the real one; HeuristicBrain runs offline (no API key,
// daily LLM budget exhausted, tests) using the SAME tools and the SAME safety path.

import type { ToolContext } from "../tools/types.js";
import { executeTool } from "../tools/registry.js";
import { runningExperiments } from "../decision/engine.js";
import { marketKey } from "../sim/market.js";
import { CHANNELS, type BusinessModel, type Channel, type MarketObservation } from "../types.js";
import { CHANNEL_PLAYBOOK } from "../strategy/playbook.js";
import { clamp, money } from "../util.js";

export interface BrainResult {
  usd: number;
  turns: number;
}

export interface Brain {
  readonly name: string;
  think(ctx: ToolContext, briefing: string, remainingUsd: number): Promise<BrainResult>;
}

const ORGANIC: Channel[] = ["marketplace", "content_seo", "community", "direct_outreach"];

export class HeuristicBrain implements Brain {
  readonly name = "heuristic";

  async think(ctx: ToolContext): Promise<BrainResult> {
    const { agent, state, cfg } = ctx;
    const call = (name: string, input: Record<string, unknown>) => executeTool(ctx, name, input);
    const actions: string[] = [];

    // Cut clear losers: half the time gone, money spent, no sales.
    for (const e of runningExperiments(state, agent.id)) {
      if (e.ticks_elapsed >= e.duration_ticks / 2 && e.conversions === 0 && e.spent > 1) {
        await call("stop_experiment", { experiment_id: e.id, reason: "metà durata senza vendite" });
        actions.push(`fermato ${e.id}`);
      }
    }

    const slots = cfg.limits.maxConcurrentExperiments - runningExperiments(state, agent.id).length;
    if (slots > 0) {
      const tested = new Set(Object.keys(agent.memory.stats));
      // v2: price-aware (a sale of a €200 service is worth more than one of a €9 product).
      const priceBonus = (o: MarketObservation) => (V2 ? 0.3 * Math.log10(Math.max(5, o.typical_price) / 30) : 0);
      const score = (o: MarketObservation) =>
        o.demand_index - 0.8 * o.competition_index + priceBonus(o) + (tested.has(o.key) ? statBonus(ctx, o.key) : 0);
      const candidates = () =>
        Object.values(agent.memory.observations)
          .filter((o) => !runningExperiments(state, agent.id).some((e) => marketKey(e.business_model, e.niche) === o.key))
          .sort((a, b) => score(b) - score(a));

      const explore = ctx.rand() < agent.strategy.exploration_rate;
      if (candidates().length < 3 || explore) await call("scan_opportunities", { count: 4 });
      const best = candidates()[0];
      if (best) {
        const deep = await call("analyze_competition", { business_model: best.business_model, niche: best.niche });
        const obs = deep.ok ? agent.memory.observations[best.key]! : best;
        const channel = V2 ? playbookChannel(ctx, obs.business_model, explore) : pickChannel(ctx, explore);
        const paid = channel === "paid_ads";
        const free = agent.capital;
        // v2: organic channels still need real effort (content, listings, outreach tools) to be seen.
        const organic = V2 ? clamp(free * 0.08, 1, 5) : clamp(free * 0.03, 0.5, 2);
        const budget = money(paid ? clamp(free * agent.strategy.risk_appetite * 0.4, 1, 6) : organic);
        const price = Math.max(5, Math.round(obs.typical_price * 0.9));
        const p = clamp(0.15 + 0.5 * (obs.demand_index - obs.competition_index + 0.5), 0.05, 0.7);
        const expected = money(price * 0.6 * (1 + 4 * obs.demand_index) * (paid ? 1 : 0.7));
        const res = await call("launch_experiment", {
          business_model: obs.business_model,
          niche: obs.niche,
          offer: `Offerta ${obs.business_model.replace(/_/g, " ")} per ${obs.niche}`,
          channel,
          price,
          budget,
          duration_ticks: paid ? 24 : 48,
          hypothesis: `Domanda ${obs.demand_index} vs concorrenza ${obs.competition_index}: prezzo leggermente sotto il tipico (€${obs.typical_price}) dovrebbe convertire.`,
          p_success: p,
          expected_revenue: expected,
          risk: paid ? "medium" : "low",
        });
        actions.push(`${res.ok && res.content.includes('"launched":true') ? "lanciato" : "valutato"} ${obs.key} via ${channel}`);
      }
    }
    await call("end_cycle", { summary: actions.join("; ") || "nessuna azione: nessuna opportunità valida o slot pieni", next_action: "MEASURE" });
    return { usd: 0, turns: 1 };
  }
}

const V2 = process.env.HEURISTIC_V1 !== "1";

/** Best-fit channel from the playbook; when exploring, try the next-best one not tested yet. */
function playbookChannel(ctx: ToolContext, model: BusinessModel, explore: boolean): Channel {
  const options = CHANNEL_PLAYBOOK[model].best;
  if (explore) {
    const untested = options.filter((c) => !ctx.agent.memory.stats[`channel:${c}`]);
    if (untested.length) return untested[0]!;
  }
  return options[0]!;
}

function statBonus(ctx: ToolContext, key: string): number {
  const s = ctx.agent.memory.stats[key];
  if (!s || s.experiments === 0) return 0;
  return clamp(s.profit / Math.max(1, s.invested), -1, 1);
}

/** Epsilon-greedy over channels using realised profit per channel. */
function pickChannel(ctx: ToolContext, explore: boolean): Channel {
  const stats = ctx.agent.memory.stats;
  if (explore) {
    const untested = CHANNELS.filter((c) => !stats[`channel:${c}`]);
    const pool = untested.length ? untested : [...CHANNELS];
    return pool[Math.floor(ctx.rand() * pool.length)]!;
  }
  let best: Channel = ORGANIC[0]!;
  let bestScore = -Infinity;
  for (const c of CHANNELS) {
    const s = stats[`channel:${c}`];
    const sc = s ? s.profit / s.experiments : c === "paid_ads" ? -0.5 : 0;
    if (sc > bestScore) [best, bestScore] = [c, sc];
  }
  return best;
}
