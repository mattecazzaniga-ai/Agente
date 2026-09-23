// Agent creation, accounting, death and reproduction.

import type { Config } from "../config.js";
import type { Agent, Strategy, State } from "../types.js";
import { KNOWN_NICHES } from "../sim/market.js";
import { hash, money, pad, rng } from "../util.js";

export function createAgent(
  state: State,
  opts: { capital: number; initialCapital: number; parent: Agent | null; strategy?: Strategy; now: string },
): Agent {
  const seq = state.global.next_agent_seq++;
  const id = `agent-${pad(seq)}`;
  const parent = opts.parent;
  const agent: Agent = {
    id,
    name: `Agent #${pad(seq)}`,
    parent_id: parent?.id ?? null,
    generation: parent ? parent.generation + 1 : 0,
    capital: money(opts.capital),
    initial_capital: opts.initialCapital,
    revenue: 0,
    expenses: 0,
    profit: 0,
    llm_cost_usd: 0,
    strategy: opts.strategy ?? {
      focus_model: null,
      focus_niche: null,
      thesis: "Nessuna strategia ancora: esplorare più modelli di business digitali con test piccoli ed economici.",
      risk_appetite: 0.3,
      exploration_rate: 0.5,
      version: 1,
    },
    memory: parent
      ? {
          lessons: parent.memory.lessons.slice(-25),
          stats: structuredClone(parent.memory.stats),
          observations: structuredClone(parent.memory.observations),
          inherited_summary: summarizeForChild(parent),
        }
      : { lessons: [], stats: {}, observations: {}, inherited_summary: null },
    status: "ACTIVE",
    status_reason: null,
    created_at: opts.now,
    last_tick_at: null,
    last_think_at: null,
    tick_count: 0,
    last_action: null,
    next_action: "RESEARCH",
    success_count: 0,
    failure_count: 0,
    children: [],
  };
  state.agents[id] = agent;
  if (parent) parent.children.push(id);
  return agent;
}

/** Record money flowing in or out. `amount` > 0 is revenue, < 0 is an expense. */
export function book(agent: Agent, revenue: number, expense: number): void {
  agent.capital = money(agent.capital + revenue - expense);
  agent.revenue = money(agent.revenue + revenue);
  agent.expenses = money(agent.expenses + expense);
  agent.profit = money(agent.revenue - agent.expenses);
}

/** Transition to DEAD when capital is exhausted. Returns true if the agent just died. */
export function checkDeath(state: State, agent: Agent, now: string): boolean {
  if (agent.status === "DEAD" || agent.capital > 0) return false;
  agent.status = "DEAD";
  agent.status_reason = `capitale esaurito (€${agent.capital}) il ${now}`;
  agent.next_action = null;
  for (const e of Object.values(state.experiments)) {
    if (e.agent_id === agent.id && (e.status === "RUNNING" || e.status === "PENDING_APPROVAL")) {
      e.status = "CANCELLED";
      e.ended_at = now;
      e.outcome_note = "agent died";
    }
  }
  return true;
}

export function population(state: State): number {
  return Object.values(state.agents).filter((a) => a.status !== "DEAD").length;
}

export function canReproduce(state: State, agent: Agent, cfg: Config): boolean {
  return (
    cfg.economy.reproductionEnabled &&
    agent.status === "ACTIVE" &&
    agent.capital >= agent.initial_capital * cfg.economy.reproductionMultiple &&
    population(state) < cfg.economy.maxPopulation
  );
}

/**
 * Split the agent: the parent keeps `initial_capital` worth of free capital, the child receives
 * `initial_capital`. The child inherits knowledge and a mutated strategy.
 */
export function reproduce(state: State, parent: Agent, cfg: Config, now: string): Agent | null {
  if (!canReproduce(state, parent, cfg)) return null;
  const endowment = parent.initial_capital;
  parent.capital = money(parent.capital - endowment);
  const child = createAgent(state, {
    capital: endowment,
    initialCapital: endowment,
    parent,
    strategy: mutateStrategy(parent, state.global.next_agent_seq),
    now,
  });
  return child;
}

/** Keep the parent's business model but move to a neighbouring niche, and jitter risk parameters. */
export function mutateStrategy(parent: Agent, salt: number): Strategy {
  const r = rng(hash(`${parent.id}:${salt}`));
  const s = parent.strategy;
  const current = s.focus_niche;
  // Prefer niches the family already researched with good demand; otherwise any known niche.
  const candidates = Object.values(parent.memory.observations)
    .filter((o) => (!s.focus_model || o.business_model === s.focus_model) && o.niche !== current)
    .sort((a, b) => b.demand_index - b.competition_index - (a.demand_index - a.competition_index))
    .map((o) => o.niche);
  const pool = candidates.length ? candidates.slice(0, 3) : KNOWN_NICHES.filter((n) => n !== current);
  const niche = pool[Math.floor(r() * pool.length)] ?? current;
  return {
    focus_model: s.focus_model,
    focus_niche: niche,
    thesis: `Variante di ${parent.name}: stesso modello (${s.focus_model ?? "da scegliere"}) applicato a "${niche}" invece di "${current ?? "-"}". ${s.thesis}`,
    risk_appetite: Math.min(0.5, Math.max(0.1, s.risk_appetite + (r() - 0.5) * 0.1)),
    exploration_rate: Math.min(0.8, Math.max(0.1, s.exploration_rate + (r() - 0.5) * 0.2)),
    version: 1,
  };
}

function summarizeForChild(parent: Agent): string {
  const best = Object.values(parent.memory.stats)
    .filter((s) => s.key.includes("|"))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
    .map((s) => `${s.key}: ${s.experiments} test, ${s.successes} successi, profitto €${money(s.profit)}`);
  return [
    `Ereditato da ${parent.name} (gen ${parent.generation}): capitale €${parent.capital}, ricavi €${parent.revenue}, spese €${parent.expenses}.`,
    `Strategia del padre: ${parent.strategy.thesis}`,
    best.length ? `Mercati migliori del padre:\n- ${best.join("\n- ")}` : "Il padre non ha ancora mercati testati.",
  ].join("\n");
}
