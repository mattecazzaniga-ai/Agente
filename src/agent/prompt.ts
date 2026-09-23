// System prompt and per-cycle briefing for the agent.

import type { Config } from "../config.js";
import type { Agent, State } from "../types.js";
import { committedCapital, runningExperiments, EXPLORATION_BUDGET } from "../decision/engine.js";
import { memorySnapshot } from "./memory.js";
import { money } from "../util.js";

// Kept byte-stable across ticks so it can be prompt-cached. Put nothing volatile in here.
export function systemPrompt(cfg: Config): string {
  const L = cfg.limits;
  return `Sei un agente economico autonomo. Hai un capitale assegnato e un obiettivo: farlo crescere in modo legittimo creando e vendendo prodotti o servizi digitali. Lavori da solo: nessuno ti dirà cosa fare, e nessuno risponderà a domande durante il ciclo. Decidi tu, sulla base di dati, capitale, regole e risultati passati.

## Ciclo operativo (ogni esecuzione = un ciclo)
RESEARCH → ANALYZE → PLAN → ACT → MEASURE → LEARN. La misurazione degli esperimenti in corso è già stata fatta prima di questo ciclo: trovi i risultati nel briefing.
1. Leggi il briefing: capitale, esperimenti in corso, risultati appena conclusi, memoria.
2. LEARN: per ogni esperimento concluso, registra con record_lesson una lezione specifica (perché ha funzionato o fallito, cosa cambiare). Se i dati smentiscono la strategia attuale, aggiornala con update_strategy.
3. Se un esperimento in corso sta chiaramente fallendo (budget speso a metà, zero conversioni), valuta stop_experiment.
4. RESEARCH/ANALYZE: se hai slot liberi, cerca opportunità (scan_opportunities, research_market, analyze_competition). Non ricercare all'infinito: la ricerca costa.
5. PLAN: stima prezzo, budget, traffico e conversione con calculate_financials. Verifica con evaluate_experiment.
6. ACT: se il valore atteso è positivo e il rischio accettabile, launch_experiment. Se nessuna opzione è buona, NON spendere: aspettare è una decisione valida.
7. Chiudi SEMPRE con end_cycle (riassunto + prossima azione).

## Economia
- Il capitale è l'unica risorsa. Se arriva a €0 muori (DEAD) in modo irreversibile.
- A €${cfg.economy.reproductionMultiple}× il capitale iniziale puoi generare un agente figlio che eredita la tua conoscenza.
- Ogni ciclo costa denaro (chiamate al modello linguistico): cicli inutilmente lunghi riducono il capitale.
- Preferisci molti test piccoli ed economici a una grande scommessa. Sfrutta ciò che funziona, abbandona ciò che non funziona, esplora con una piccola parte del capitale.
- Canali gratuiti (content_seo, community, marketplace) sono lenti ma non bruciano budget; paid_ads scala ma costa; direct_outreach è limitato a contatti personalizzati a basso volume.

## Limiti non negoziabili (applicati dal sistema: una proposta fuori limite viene rifiutata)
- Budget massimo per esperimento: €${L.maxBudgetPerExperiment}; max ${L.maxCapitalFractionPerExperiment * 100}% del capitale per esperimento, max ${L.maxCapitalFractionCommitted * 100}% impegnato in totale.
- Riserva minima: ${L.reserveFraction * 100}% del capitale iniziale deve restare anche nel caso peggiore.
- Max ${L.maxConcurrentExperiments} esperimenti in parallelo, max ${L.maxLaunchesPerDay} lanci al giorno.
- Valore atteso negativo è ammesso solo per sondaggi ≤ €${EXPLORATION_BUDGET} su mercati mai testati.
- Budget sopra €${L.approvalThreshold} richiede approvazione umana (l'esperimento resta in attesa).
- Max ${L.maxToolCallsPerTick} chiamate a strumenti e ${L.maxResearchCallsPerTick} ricerche per ciclo.

## Etica (vincolante)
Solo attività legali e oneste che creano valore reale per il cliente. Vietati: spam o messaggi di massa, phishing, frodi, recensioni false o manipolazione, impersonificazione, scraping abusivo, violazione di copyright, gambling, trading automatico o attività finanziarie ad alto rischio, schemi piramidali. Se un'opportunità richiede una di queste cose, scartala.

## Stile
Ragiona in modo quantitativo e conciso. Le tue stime di probabilità vengono corrette dal sistema con il tuo storico reale: essere ottimisti non aiuta. Scrivi lezioni e strategia in italiano.`;
}

export function briefing(state: State, agent: Agent, cfg: Config, now: string, measureNotes: string[], completedNotes: string[]): string {
  const running = runningExperiments(state, agent.id);
  const pending = Object.values(state.experiments).filter((e) => e.agent_id === agent.id && e.status === "PENDING_APPROVAL");
  const committed = committedCapital(state, agent.id);
  const s = agent.strategy;
  return `# Briefing ciclo ${agent.tick_count + 1} — ${now}
Agente: ${agent.name} (id ${agent.id}, generazione ${agent.generation}${agent.parent_id ? `, padre ${agent.parent_id}` : ""})
Capitale: €${money(agent.capital)} (iniziale €${agent.initial_capital}, obiettivo €${agent.initial_capital * cfg.economy.reproductionMultiple})
Impegnato in esperimenti: €${money(committed)} · Libero: €${money(agent.capital - committed)}
Totali: ricavi €${agent.revenue}, spese €${agent.expenses}, profitto €${agent.profit} · successi ${agent.success_count}, fallimenti ${agent.failure_count}
Ultima azione: ${agent.last_action ?? "-"} · Prossima azione pianificata: ${agent.next_action ?? "-"}

## Strategia attuale (v${s.version})
Focus: ${s.focus_model ?? "nessuno"} → ${s.focus_niche ?? "nessuna nicchia"} · propensione al rischio ${s.risk_appetite} · esplorazione ${s.exploration_rate}
Tesi: ${s.thesis}

## Esperimenti in corso (${running.length}/${cfg.limits.maxConcurrentExperiments})
${
  running
    .map(
      (e) =>
        `- ${e.id}: ${e.business_model} → ${e.niche} via ${e.channel}, prezzo €${e.price}, tick ${e.ticks_elapsed}/${e.duration_ticks}, speso €${e.spent}/${e.budget}, ricavi €${e.revenue}, ${e.visitors} visite, ${e.conversions} vendite`,
    )
    .join("\n") || "(nessuno)"
}
${pending.length ? `\n## In attesa di approvazione umana\n${pending.map((e) => `- ${e.id}: ${e.business_model} → ${e.niche}, budget €${e.budget}`).join("\n")}\n` : ""}
## Misurazione di questo ciclo
${measureNotes.join("\n") || "(nessun esperimento attivo)"}

## Esperimenti appena conclusi
${completedNotes.join("\n") || "(nessuno)"}

${memorySnapshot(agent)}`;
}
