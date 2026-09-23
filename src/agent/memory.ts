// Strategy memory: structured stats per business model / market plus free-text lessons.

import type { Agent, Experiment, Lesson, StrategyStats } from "../types.js";
import { marketKey } from "../sim/market.js";
import { money } from "../util.js";

const MAX_LESSONS = 60;

function emptyStats(key: string): StrategyStats {
  return { key, experiments: 0, successes: 0, invested: 0, revenue: 0, costs: 0, profit: 0, ticks: 0, visitors: 0, conversions: 0 };
}

export function experimentProfit(e: Experiment): number {
  return money(e.revenue - e.spent - e.fulfillment_costs);
}

export function recordOutcome(agent: Agent, e: Experiment): void {
  const profit = experimentProfit(e);
  const success = profit > 0;
  for (const key of [e.business_model, marketKey(e.business_model, e.niche), `channel:${e.channel}`]) {
    const s = (agent.memory.stats[key] ??= emptyStats(key));
    s.experiments += 1;
    s.successes += success ? 1 : 0;
    s.invested = money(s.invested + e.spent);
    s.revenue = money(s.revenue + e.revenue);
    s.costs = money(s.costs + e.spent + e.fulfillment_costs);
    s.profit = money(s.profit + profit);
    s.ticks += e.ticks_elapsed;
    s.visitors += e.visitors;
    s.conversions += e.conversions;
  }
  if (success) agent.success_count += 1;
  else agent.failure_count += 1;
}

export function addLesson(agent: Agent, lesson: Lesson): void {
  agent.memory.lessons.push(lesson);
  if (agent.memory.lessons.length > MAX_LESSONS) agent.memory.lessons.splice(0, agent.memory.lessons.length - MAX_LESSONS);
}

/** Automatic, factual lesson written for every completed experiment (the LLM can add its own on top). */
export function factualLesson(e: Experiment, now: string): Lesson {
  const profit = experimentProfit(e);
  const cr = e.visitors ? ((e.conversions / e.visitors) * 100).toFixed(2) : "n/a";
  const verdict = profit > 0 ? "SUCCESSO" : "FALLIMENTO";
  let why: string;
  if (e.visitors === 0) why = "nessun traffico: canale inadatto o budget troppo basso";
  else if (e.conversions === 0) why = "traffico senza conversioni: offerta/prezzo non convincenti o domanda debole";
  else if (profit <= 0) why = "conversioni insufficienti a coprire costi di acquisizione e consegna";
  else why = "l'offerta ha coperto i costi con margine";
  return {
    at: now,
    experiment_id: e.id,
    text: `${verdict} ${e.id} [${e.business_model} → ${e.niche} via ${e.channel}, prezzo €${e.price}]: speso €${money(e.spent)}, ricavi €${money(
      e.revenue,
    )}, consegna €${money(e.fulfillment_costs)}, profitto €${profit}, ${e.visitors} visite, ${e.conversions} conversioni (CR ${cr}%), ${e.ticks_elapsed} tick. Motivo: ${why}.`,
    tags: [e.business_model, e.channel, profit > 0 ? "success" : "failure"],
  };
}

/** Compact, prompt-friendly view of the memory. */
export function memorySnapshot(agent: Agent): string {
  const stats = Object.values(agent.memory.stats)
    .sort((a, b) => b.profit - a.profit)
    .map(
      (s) =>
        `- ${s.key}: ${s.experiments} test, ${s.successes} ok, investito €${s.invested}, ricavi €${s.revenue}, profitto €${s.profit}, CR ${
          s.visitors ? ((s.conversions / s.visitors) * 100).toFixed(2) + "%" : "n/a"
        }`,
    );
  const obs = Object.values(agent.memory.observations)
    .sort((a, b) => b.demand_index - b.competition_index - (a.demand_index - a.competition_index))
    .slice(0, 12)
    .map(
      (o) =>
        `- ${o.key} [${o.source}]: domanda ${o.demand_index}, concorrenza ${o.competition_index}, prezzo tipico €${o.typical_price} (${o.observed_at.slice(0, 16)})` +
        (o.source === "web" ? `\n  ${o.notes.slice(0, 240)}${o.sources?.length ? ` — fonti: ${o.sources.slice(0, 2).join(", ")}` : ""}` : ""),
    );
  const lessons = agent.memory.lessons.slice(-12).map((l) => `- ${l.text}`);
  return [
    agent.memory.inherited_summary ? `## Conoscenza ereditata\n${agent.memory.inherited_summary}` : null,
    `## Statistiche per strategia\n${stats.join("\n") || "(nessun esperimento concluso)"}`,
    `## Migliori osservazioni di mercato\n${obs.join("\n") || "(nessuna ricerca ancora)"}`,
    `## Lezioni recenti\n${lessons.join("\n") || "(nessuna)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
