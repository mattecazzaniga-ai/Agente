// Phase 1 tools. Research is backed by the simulator; everything else is real logic
// (memory, finance maths, decision engine, experiment lifecycle).

import { BUSINESS_MODELS, CHANNELS, type BusinessModel, type Channel, type MarketObservation } from "../types.js";
import type { ToolContext, ToolDef } from "./types.js";
import { KNOWN_NICHES, marketKey, observe } from "../sim/market.js";
import { committedCapital, evaluate, type Proposal } from "../decision/engine.js";
import { createExperiment, completeExperiment } from "../agent/experiments.js";
import { addLesson, memorySnapshot } from "../agent/memory.js";
import { book } from "../economy/lifecycle.js";
import { clamp, money } from "../util.js";

/** Virtual cost of research actions (stands in for search API / data costs). */
const RESEARCH_COST = 0.02;
const DEEP_RESEARCH_COST = 0.05;

function str(input: Record<string, unknown>, k: string): string {
  const v = input[k];
  if (typeof v !== "string" || !v.trim()) throw new Error(`"${k}" must be a non-empty string`);
  return v.trim();
}
function numIn(input: Record<string, unknown>, k: string): number {
  const v = input[k];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`"${k}" must be a number`);
  return v;
}
function model(input: Record<string, unknown>): BusinessModel {
  const m = str(input, "business_model");
  if (!(BUSINESS_MODELS as readonly string[]).includes(m)) throw new Error(`unknown business_model "${m}"`);
  return m as BusinessModel;
}
function channel(input: Record<string, unknown>): Channel {
  const c = str(input, "channel");
  if (!(CHANNELS as readonly string[]).includes(c)) throw new Error(`unknown channel "${c}"`);
  return c as Channel;
}

function webRule(ctx: ToolContext) {
  return { requireWebObservation: ctx.brain === "llm" && ctx.cfg.phase >= 2 };
}

/** Research is paid from free capital like everything else: never below the reserve. */
function assertCanSpend(ctx: ToolContext, cost: number): void {
  const free = ctx.agent.capital - committedCapital(ctx.state, ctx.agent.id);
  const reserve = ctx.agent.initial_capital * ctx.cfg.limits.reserveFraction;
  if (free - cost < reserve) throw new Error(`research refused: free capital €${money(free)} would go below the reserve €${money(reserve)}`);
}

function chargeResearch(ctx: ToolContext, cost: number): void {
  book(ctx.agent, 0, cost);
}

const modelSchema = { type: "string", enum: [...BUSINESS_MODELS] };
const nicheSchema = { type: "string", description: "Target customer segment, e.g. 'palestre', 'dentisti a Milano'." };

const proposalSchema = {
  type: "object" as const,
  properties: {
    business_model: modelSchema,
    niche: nicheSchema,
    offer: { type: "string", description: "Concrete offer: what the customer gets, in one or two sentences." },
    channel: { type: "string", enum: [...CHANNELS] },
    price: { type: "number", description: "Price per sale in EUR." },
    budget: { type: "number", description: "Total EUR to spend over the experiment (ads, tools, listing boosts). 0 is allowed for organic channels." },
    duration_ticks: { type: "integer", description: "How many ticks (≈ hours) the experiment runs." },
    hypothesis: { type: "string", description: "Why this should make money and what result would falsify it." },
    p_success: { type: "number", description: "Your probability (0-1) that the experiment ends with profit > 0." },
    expected_revenue: { type: "number", description: "Expected revenue net of delivery costs if it works, EUR, excluding budget." },
    risk: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["business_model", "niche", "offer", "channel", "price", "budget", "duration_ticks", "hypothesis", "p_success", "expected_revenue", "risk"],
  additionalProperties: false,
};

function toProposal(input: Record<string, unknown>): Proposal {
  const risk = str(input, "risk");
  if (!["low", "medium", "high"].includes(risk)) throw new Error(`invalid risk "${risk}"`);
  return {
    business_model: model(input),
    niche: str(input, "niche"),
    offer: str(input, "offer"),
    channel: channel(input),
    price: numIn(input, "price"),
    budget: numIn(input, "budget"),
    duration_ticks: numIn(input, "duration_ticks"),
    hypothesis: str(input, "hypothesis"),
    estimates: { p_success: clamp(numIn(input, "p_success"), 0, 1), expected_revenue: numIn(input, "expected_revenue"), risk: risk as "low" | "medium" | "high" },
  };
}

export const phase1Tools: ToolDef[] = [
  {
    name: "scan_opportunities",
    description:
      "Broad scan: returns noisy demand/competition signals for several (business_model, niche) pairs you have not researched yet. Cheap first step to find candidate opportunities.",
    input_schema: {
      type: "object",
      properties: {
        business_models: { type: "array", items: modelSchema, description: "Restrict to these models (optional)." },
        count: { type: "integer", description: "How many pairs (1-5)." },
      },
      additionalProperties: false,
    },
    permission: "auto",
    phase: 1,
    research: true,
    simulatedResearch: true,
    run(ctx, input) {
      const models = Array.isArray(input.business_models) && input.business_models.length ? (input.business_models as BusinessModel[]) : [...BUSINESS_MODELS];
      const count = clamp(Math.floor(Number(input.count ?? 3)), 1, 5);
      assertCanSpend(ctx, RESEARCH_COST * count);
      const out: MarketObservation[] = [];
      for (let tries = 0; out.length < count && tries < 50; tries++) {
        const m = models[Math.floor(ctx.rand() * models.length)]!;
        const n = KNOWN_NICHES[Math.floor(ctx.rand() * KNOWN_NICHES.length)]!;
        if (ctx.agent.memory.observations[marketKey(m, n)] || out.some((o) => o.key === marketKey(m, n))) continue;
        const o = observe(ctx.state.global.world_seed, m, n, 0.2, ctx.rand, ctx.now, ctx.state.global.market_anchors);
        ctx.agent.memory.observations[o.key] = o;
        out.push(o);
      }
      chargeResearch(ctx, RESEARCH_COST * out.length);
      return { cost_eur: money(RESEARCH_COST * out.length), opportunities: out };
    },
  },
  {
    name: "research_market",
    description: "Research demand, competition and typical price for one (business_model, niche) pair. Medium precision.",
    input_schema: { type: "object", properties: { business_model: modelSchema, niche: nicheSchema }, required: ["business_model", "niche"], additionalProperties: false },
    permission: "auto",
    phase: 1,
    research: true,
    simulatedResearch: true,
    run(ctx, input) {
      assertCanSpend(ctx, RESEARCH_COST);
      const o = observe(ctx.state.global.world_seed, model(input), str(input, "niche"), 0.5, ctx.rand, ctx.now, ctx.state.global.market_anchors);
      ctx.agent.memory.observations[o.key] = o;
      chargeResearch(ctx, RESEARCH_COST);
      return { cost_eur: RESEARCH_COST, observation: o };
    },
  },
  {
    name: "analyze_competition",
    description: "Deeper, more precise analysis of one market (competitors, pricing). Costs more than research_market; use it before committing budget.",
    input_schema: { type: "object", properties: { business_model: modelSchema, niche: nicheSchema }, required: ["business_model", "niche"], additionalProperties: false },
    permission: "auto",
    phase: 1,
    research: true,
    simulatedResearch: true,
    run(ctx, input) {
      assertCanSpend(ctx, DEEP_RESEARCH_COST);
      const o = observe(ctx.state.global.world_seed, model(input), str(input, "niche"), 0.85, ctx.rand, ctx.now, ctx.state.global.market_anchors);
      ctx.agent.memory.observations[o.key] = o;
      chargeResearch(ctx, DEEP_RESEARCH_COST);
      return { cost_eur: DEEP_RESEARCH_COST, observation: o };
    },
  },
  {
    name: "calculate_financials",
    description: "Pure maths: projected revenue, profit, ROI and break-even conversions for a hypothetical offer. Free.",
    input_schema: {
      type: "object",
      properties: {
        price: { type: "number" },
        budget: { type: "number" },
        expected_visitors: { type: "number" },
        conversion_rate: { type: "number", description: "0-1" },
        delivery_cost_pct: { type: "number", description: "0-1 share of price spent delivering each sale" },
        platform_fee_pct: { type: "number", description: "0-1 (e.g. 0.2 for marketplaces)" },
      },
      required: ["price", "budget", "expected_visitors", "conversion_rate"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 1,
    run(_ctx, input) {
      const price = numIn(input, "price");
      const budget = numIn(input, "budget");
      const visitors = numIn(input, "expected_visitors");
      const cr = clamp(numIn(input, "conversion_rate"), 0, 1);
      const delivery = clamp(Number(input.delivery_cost_pct ?? 0.2), 0, 1);
      const fee = clamp(Number(input.platform_fee_pct ?? 0.03), 0, 1);
      const unitMargin = price * (1 - fee - delivery);
      const sales = visitors * cr;
      const profit = sales * unitMargin - budget;
      return {
        expected_sales: Math.round(sales * 100) / 100,
        unit_margin_eur: money(unitMargin),
        expected_net_revenue_eur: money(sales * unitMargin),
        expected_profit_eur: money(profit),
        roi: budget > 0 ? Math.round((profit / budget) * 100) / 100 : null,
        break_even_sales: unitMargin > 0 ? Math.ceil(budget / unitMargin) : null,
        break_even_conversion_rate: unitMargin > 0 && visitors > 0 ? Math.round((budget / unitMargin / visitors) * 10000) / 10000 : null,
      };
    },
  },
  {
    name: "query_memory",
    description: "Read your strategy memory: stats per strategy, market observations, lessons. Optionally filter by a key substring.",
    input_schema: { type: "object", properties: { filter: { type: "string" } }, additionalProperties: false },
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      const f = typeof input.filter === "string" ? input.filter.toLowerCase() : null;
      if (!f) return memorySnapshot(ctx.agent);
      const m = ctx.agent.memory;
      return {
        stats: Object.values(m.stats).filter((s) => s.key.toLowerCase().includes(f)),
        observations: Object.values(m.observations).filter((o) => o.key.includes(f)),
        lessons: m.lessons.filter((l) => l.text.toLowerCase().includes(f) || l.tags.some((t) => t.includes(f))).slice(-15),
      };
    },
  },
  {
    name: "evaluate_experiment",
    description: "Dry-run the decision engine on a proposal: returns adjusted probability, expected value, worst case and every limit it would hit. Does not spend anything.",
    input_schema: proposalSchema,
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      return evaluate(ctx.state, ctx.agent, toProposal(input), ctx.cfg, ctx.now, webRule(ctx));
    },
  },
  {
    name: "launch_experiment",
    description:
      "Commit capital to an experiment. The decision engine re-checks it; if rejected nothing is spent and you get the reasons. Budgets above the approval threshold wait for human approval.",
    input_schema: proposalSchema,
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      const p = toProposal(input);
      const decision = evaluate(ctx.state, ctx.agent, p, ctx.cfg, ctx.now, webRule(ctx));
      if (!decision.approved) {
        ctx.log("experiment_rejected", `${p.business_model} → ${p.niche} rejected`, { proposal: p, decision });
        return { launched: false, decision };
      }
      const exp = createExperiment(ctx.state, ctx.agent, p, decision, ctx.now);
      ctx.agent.last_action = `launch ${exp.id}`;
      ctx.log("experiment_created", `${exp.id} ${exp.status}: ${p.business_model} → ${p.niche} via ${p.channel}, budget €${p.budget}`, { experiment: exp });
      return { launched: exp.status === "RUNNING", status: exp.status, experiment_id: exp.id, decision };
    },
  },
  {
    name: "stop_experiment",
    description: "Stop one of your running experiments early (e.g. clearly failing) to save the remaining budget. Results so far are recorded as a completed experiment.",
    input_schema: { type: "object", properties: { experiment_id: { type: "string" }, reason: { type: "string" } }, required: ["experiment_id", "reason"], additionalProperties: false },
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      const e = ctx.state.experiments[str(input, "experiment_id")];
      if (!e || e.agent_id !== ctx.agent.id || e.status !== "RUNNING") throw new Error("no such running experiment of yours");
      completeExperiment(ctx.agent, e, ctx.now, `fermato: ${str(input, "reason")}`);
      ctx.log("experiment_stopped", `${e.id} stopped early`, { reason: input.reason });
      return { stopped: e.id, saved_budget_eur: money(e.budget - e.spent) };
    },
  },
  {
    name: "record_lesson",
    description: "Write a lesson to long-term memory (what worked, what failed and why, what to try next). Be specific and quantitative.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" }, tags: { type: "array", items: { type: "string" } }, experiment_id: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      addLesson(ctx.agent, {
        at: ctx.now,
        experiment_id: typeof input.experiment_id === "string" ? input.experiment_id : null,
        text: str(input, "text").slice(0, 1000),
        tags: Array.isArray(input.tags) ? (input.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 8) : [],
      });
      return { saved: true };
    },
  },
  {
    name: "update_strategy",
    description: "Change your current strategy (focus business model/niche, thesis, risk appetite, exploration rate). Explain the change in the thesis.",
    input_schema: {
      type: "object",
      properties: {
        focus_model: { type: ["string", "null"], enum: [...BUSINESS_MODELS, null] },
        focus_niche: { type: ["string", "null"] },
        thesis: { type: "string" },
        risk_appetite: { type: "number", description: "0.05-0.5" },
        exploration_rate: { type: "number", description: "0-1" },
      },
      required: ["thesis"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      const s = ctx.agent.strategy;
      if (input.focus_model !== undefined) s.focus_model = input.focus_model === null ? null : model({ business_model: input.focus_model });
      if (input.focus_niche !== undefined) s.focus_niche = typeof input.focus_niche === "string" ? input.focus_niche.trim().toLowerCase() : null;
      s.thesis = str(input, "thesis").slice(0, 1500);
      if (typeof input.risk_appetite === "number") s.risk_appetite = clamp(input.risk_appetite, 0.05, 0.5);
      if (typeof input.exploration_rate === "number") s.exploration_rate = clamp(input.exploration_rate, 0, 1);
      s.version += 1;
      ctx.log("strategy_updated", `strategy v${s.version}: ${s.thesis.slice(0, 120)}`, { strategy: s });
      return { strategy: s };
    },
  },
  {
    name: "end_cycle",
    description: "Finish this operating cycle. Always call this last, with a short summary of what you did and the next action you plan.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" }, next_action: { type: "string" } },
      required: ["summary", "next_action"],
      additionalProperties: false,
    },
    permission: "auto",
    phase: 1,
    run(ctx, input) {
      ctx.cycleEnd = { summary: str(input, "summary").slice(0, 2000), next_action: str(input, "next_action").slice(0, 500) };
      return { ok: true };
    },
  },
];
