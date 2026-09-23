# Architettura — Sistema di agenti economici autonomi

Stato: **Phase 1 implementata** (agente singolo, economia simulata, cervello Claude reale o euristico offline, esecuzione 24/7 su GitHub Actions).

---

## 1. Analisi del progetto

**Obiettivo:** entità software autonome con capitale, obiettivo, memoria e strategia, che cercano opportunità economiche legittime, agiscono, misurano, imparano e — raggiunto 2× il capitale — si riproducono.

Punti fermi che guidano il design:

1. **Il ciclo conta più dell'intelligenza.** Un agente utile è un loop affidabile *RESEARCH → ANALYZE → PLAN → ACT → MEASURE → LEARN* che gira ogni ora per mesi senza rompersi, senza spendere oltre i limiti e lasciando traccia di tutto. Per questo Phase 1 sostituisce il *mondo* con un simulatore, ma **non** l'agente: il loop, gli strumenti, il decision engine, la memoria, la contabilità e la sicurezza sono quelli definitivi.
2. **L'LLM propone, il codice dispone.** Claude decide *cosa* fare e *quando* usare uno strumento; un decision engine deterministico decide se è *permesso* (budget, riserva, valore atteso, policy). Nessun limite di sicurezza dipende dal fatto che il modello "si comporti bene".
3. **Onestà dei numeri.** Il costo reale di Claude viene scalato dal capitale virtuale: un agente che pensa troppo e guadagna poco muore, come nella realtà.
4. **Aspettative realistiche.** Il simulatore è calibrato in modo che circa metà delle vite dell'agente euristico ristagni o perda e poche trovino mercati redditizi: la maggior parte dei micro-business fallisce, e il valore del sistema sta nel fallire in piccolo, in fretta e imparando.
5. **Identità legale.** Un agente software non può aprire un conto, una partita IVA o un account Stripe. Quando si passerà a denaro reale (Phase 4) **l'entità legale sarai tu**: gli account (Stripe, dominio, marketplace) saranno tuoi, con chiavi a permessi minimi, e ogni prima azione pubblica/pagante passa da un'approvazione umana.

## 2. Architettura

```
                ┌──────────────────────── GitHub Actions (cron ogni ora) ───────────────────────┐
                │                                                                                │
  agent-state ──┤  load state ──► runTick()                                                      │
   (branch)     │                   │                                                            │
      ▲         │                   ├─ Safety guard: kill switch globale/agente, stato, rate limit│
      │         │                   ├─ MEASURE: avanza esperimenti, contabilizza ricavi/costi      │
      │         │                   ├─ LEARN: statistiche + lezioni fattuali automatiche          │
      │         │                   ├─ serve pensare? (esperimento concluso / slot libero / 6h)   │
      │         │                   ├─ THINK: Brain ──► tool calls ──► Tool registry (permessi)   │
      │         │                   │           │                        │                        │
      │         │                   │     Claude API               Decision engine (EV, rischio,  │
      │         │                   │   (o euristico)              riserva, limiti, policy)       │
      │         │                   │                                    │                        │
      │         │                   │                     Mondo: simulatore (Phase 1)             │
      │         │                   │                            web reale (Phase 2+)             │
      │         │                   ├─ costo LLM → capitale, limiti giornalieri                   │
      │         │                   ├─ morte (capitale ≤ 0) / riproduzione (≥ 2×, Phase 5)        │
      └─────────┴── commit state.json + log/*.jsonl ◄──────────────────────────────────────────────┘

  Operatore: GitHub → Actions → agent → Run workflow  (status, pause, kill, killswitch, approve…)
             oppure CLI locale (npm run cli -- …)
```

### Perché GitHub Actions (e non Vercel) per il loop

| Opzione | Pro | Contro |
|---|---|---|
| **GitHub Actions cron** ✅ | Gratis (repo pubblico) o 2.000 min/mese (privato); job fino a 6 h; stato versionato con git (audit completo, rollback con un revert); controllo manuale da telefono tramite "Run workflow"; nessun server da gestire | Cron minimo 5 min e a volte in ritardo di qualche minuto; nei repo pubblici i workflow schedulati si disattivano dopo 60 giorni senza attività |
| Vercel Cron + Functions | Ottimo per pagine/landing e dashboard | Timeout delle funzioni (il ciclo con 10+ chiamate a Claude può superarli), niente disco persistente → serve comunque un DB esterno; cron limitato sul piano gratuito |
| Claude Managed Agents (scheduled deployments) | Loop e sandbox gestiti da Anthropic | Il livello di sicurezza economica deve restare nostro e deterministico; da valutare in Phase 3 per i compiti "da lavoratore" (generare codice/contenuti in sandbox) |
| VPS / Fly.io worker | Processo sempre acceso, latenza zero | Costo fisso, manutenzione; non serve finché il ciclo è orario |

**Scelta:** GitHub Actions per il ciclo; **Vercel** entra in Phase 3 per ospitare landing page e prodotti creati dagli agenti (deploy solo con approvazione); **Postgres gestito** (Neon/Supabase free tier) sostituisce `state.json` quando ci saranno più agenti o dati reali (schema pronto in `db/schema.sql`, interfaccia `Store` già astratta).

## 3. API e servizi

| Servizio | Fase | Uso | Obbligatorio |
|---|---|---|---|
| GitHub (repo + Actions) | 1 | codice, scheduler, stato, controllo | sì |
| Claude API (`@anthropic-ai/sdk`) | 1 | cervello dell'agente (tool use, adaptive thinking) | no in Phase 1 (senza chiave gira il cervello euristico) |
| Claude web search / web fetch (server tools) | 2 | ricerca reale di domanda, concorrenza, prezzi | sì da Phase 2 |
| Postgres gestito (Neon / Supabase) | 2–3 | stato e storico quando `state.json` non basta | consigliato |
| Vercel | 3 | pubblicazione landing page / micro-SaaS | sì da Phase 3 |
| Dominio | 3 | credibilità delle pagine | consigliato |
| Plausible / Vercel Analytics | 4 | misura reale di visite e conversioni | sì da Phase 4 |
| Stripe (payment links, chiave restricted in sola lettura per le metriche) | 4 | incasso reale | sì da Phase 4 |
| Email transazionale (Resend/Postmark) | 3–4 | consegna prodotti, notifiche approvazioni | opzionale |

## 4. Cosa è completamente autonomo (Phase 1)

- Ciclo orario: misurazione, apprendimento, decisione, esecuzione.
- Ricerca e analisi di mercato (simulate), calcoli finanziari, lettura/scrittura della memoria.
- Lancio, prosecuzione e interruzione anticipata di esperimenti **entro i limiti** (budget ≤ €12 senza approvazione, max €15, ≤ 30% del capitale per esperimento, ≤ 50% impegnato in totale, riserva 20%, max 2 in parallelo, max 3 lanci/giorno).
- Aggiornamento della propria strategia e delle lezioni.
- Morte a capitale ≤ 0; riproduzione a 2× (quando abilitata in Phase 5).
- Fallback: se l'API Claude fallisce il ciclo prosegue con il cervello euristico; se il budget LLM giornaliero finisce l'agente continua solo a misurare.

## 5. Cosa richiede approvazione umana

| Azione | Da fase | Meccanismo |
|---|---|---|
| Esperimento con budget > `APPROVAL_THRESHOLD` (€12) | 1 | resta `PENDING_APPROVAL`; `approve`/`deny`, con rivalutazione al momento dell'approvazione |
| Abilitare Claude API (spesa reale) | 1 | `LLM_ENABLED=true` + secret `ANTHROPIC_API_KEY` impostati da te |
| Pubblicare qualsiasi cosa online (landing, listing su marketplace) | 3 | tool con permesso `approval` |
| Inviare messaggi a persone reali | 3 | `approval`, un messaggio alla volta, tetto giornaliero, mai liste acquistate |
| Qualsiasi spesa di denaro reale, creazione di link di pagamento | 4 | `approval` sempre, più tetto mensile a livello di account (Stripe/ads) |
| Abilitare la riproduzione / aumentare `MAX_POPULATION` | 5 | variabile di configurazione |

I tool futuri sono già dichiarati con il loro permesso in `src/tools/registry.ts` (`PLANNED_TOOLS`): `npm run cli -- tools` li elenca.

## 6. Costi previsti

| Voce | Phase 1 | Note |
|---|---|---|
| GitHub Actions | €0 | ~1 min per run × 24 × 30 ≈ 720 min/mese: gratis su repo pubblico, entro i 2.000 min gratuiti su privato |
| Claude API | **€0 senza chiave**; con chiave, **al massimo `MAX_LLM_USD_PER_DAY`** (default $1/giorno ≈ $30/mese) | Stima per ciclo di decisione con `claude-opus-5`: ~$0,05–0,25 (system prompt e strumenti in cache). Claude viene svegliato solo quando c'è da decidere (esperimento concluso, slot libero ogni 2 h, revisione ogni 6 h) → tipicamente 5–12 cicli/giorno. Con `AGENT_MODEL=claude-sonnet-5` il costo per ciclo scende di circa il 60%. |
| Tutto il resto | €0 | |
| Phase 2 | + ricerca web ≈ $10 / 1.000 ricerche (+ token) | con max 6 ricerche/ciclo: pochi dollari al mese |
| Phase 3–4 | dominio ~€10/anno; Vercel/Neon/Plausible nel piano gratuito o pochi €/mese; Stripe solo commissioni sulle vendite | più il capitale reale che deciderai di assegnare |

## 7. Rischi tecnici

| Rischio | Mitigazione |
|---|---|
| L'LLM propone azioni rischiose o vietate | decision engine deterministico + filtro di policy + permessi per tool + approvazione umana; l'LLM non può modificare i limiti |
| Spesa LLM fuori controllo | tetto per ciclo e per giorno, loop con max turni, risveglio solo quando serve, caching del prompt, costo addebitato al capitale |
| Stime ottimistiche dell'LLM | la probabilità viene fusa con lo storico reale (prior Beta) e limitata a 0,8; EV negativo ammesso solo per sondaggi ≤ €3 |
| Doppia esecuzione / corse sullo stato | `concurrency` del workflow + rate limit per agente (20 min) + scrittura atomica |
| Stato corrotto o perso | stato versionato su git (ogni run è un commit: storico completo e rollback) |
| API non disponibile / timeout | retry dell'SDK, timeout di ciclo (8 min), fallback euristico |
| Cron GitHub in ritardo o disattivato dopo 60 giorni (repo pubblici) | il ciclo è idempotente rispetto al ritardo; i commit sullo stato mantengono il repo attivo; in alternativa repo privato |
| Il simulatore insegna cose false | è un banco di prova del *ciclo*, non del mercato: la conoscenza simulata va azzerata o marcata `source: simulated` quando si passa ai dati reali (già marcata così) |
| Prompt injection da pagine web (Phase 2) | i contenuti web sono dati, non istruzioni; strumenti che agiscono all'esterno sempre `approval`; domini bloccabili |
| Conformità (GDPR, anti-spam, termini dei marketplace) | niente raccolta di dati personali, outreach solo B2B/opt-in e con approvazione, rispetto di robots.txt e ToS |

## 8. Struttura dei file

```
src/
  cli.ts                 comandi operatore (init, tick, simulate, status, pause, kill, approve…)
  env.ts                 caricamento .env
  config.ts              TUTTI i limiti e i parametri (sovrascrivibili da env)
  types.ts               modello dati: Agent, Experiment, Memory, Approval, State
  util.ts                RNG deterministico, arrotondamenti
  agent/
    loop.ts              il ciclo operativo (runTick)
    brain.ts             interfaccia Brain + cervello euristico offline
    prompt.ts            system prompt (stabile, in cache) + briefing del ciclo
    memory.ts            strategy memory: statistiche, lezioni, snapshot
    experiments.ts       ciclo di vita esperimenti: crea, misura, concludi
  llm/claude.ts          cervello Claude: loop di tool use manuale con limiti e costi
  decision/engine.ts     valore atteso, rischio, riserva, limiti, approvazioni
  safety/guard.ts        kill switch, rate limit, budget LLM, filtro di policy
  economy/lifecycle.ts   creazione agenti, contabilità, morte, riproduzione e mutazione
  tools/
    types.ts             ToolDef, permessi (auto | approval | disabled), contesto
    registry.ts          registro, fasi, strumenti pianificati, esecuzione controllata
    phase1.ts            strumenti Phase 1
  sim/market.ts          mondo simulato (Phase 1)
  store/                 interfaccia Store + implementazione JSON
db/schema.sql            schema Postgres per Phase 2+
test/                    test (node:test)
.github/workflows/
  agent.yml              scheduler orario + comandi manuali
  ci.yml                 typecheck + test
docs/                    questa documentazione + SETUP
```

## 9. Database / schema

Phase 1: `state.json` (sul branch `agent-state`) con `global`, `agents`, `experiments`, `approvals`, più log append-only `log/YYYY-MM-DD.jsonl`. Ogni run è un commit: il repository **è** l'audit log.

Phase 2+: Postgres con le tabelle in [`db/schema.sql`](../db/schema.sql): `agents`, `experiments`, `ledger` (ogni movimento di denaro, con flag `real_money` e riferimento esterno Stripe), `lessons`, `strategy_stats`, `market_observations` (con fonti citate), `approvals`, `events`, `global_state`, `daily_counters`.

Campi dell'agente (tutti quelli richiesti): `id, parent_id, generation, capital, initial_capital, revenue, expenses, profit, strategy, memory, status, created_at, last_action, next_action, success_count, failure_count` + `llm_cost_usd, last_tick_at, last_think_at, tick_count, children, status_reason`.

## 10. Ciclo operativo dell'agente

Ogni ora (`runTick`):

1. **Guard** — kill switch globale (stato o variabile `AGENT_KILL_SWITCH`), stato dell'agente (solo `ACTIVE`), rate limit.
2. **MEASURE** — ogni esperimento in corso avanza di un tick: spesa, visite, conversioni, ricavi, costi di consegna vengono contabilizzati sul capitale.
3. **LEARN (automatico)** — a fine esperimento: statistiche per modello, per mercato (modello|nicchia) e per canale; lezione fattuale con numeri e motivo del successo/fallimento.
4. **Morte** — capitale ≤ 0 → `DEAD`, esperimenti annullati, nessuna ulteriore operazione.
5. **Serve pensare?** — Claude viene svegliato solo se un esperimento si è concluso, se c'è uno slot libero (al massimo ogni 2 h) o per la revisione periodica (ogni 6 h).
6. **THINK/ACT** — Claude riceve il briefing (capitale, esperimenti, risultati, memoria) e decide da solo quali strumenti usare: registra lezioni, aggiorna la strategia, ferma esperimenti in perdita, ricerca, calcola, valuta (`evaluate_experiment`), lancia (`launch_experiment`), chiude con `end_cycle`. Ogni chiamata passa da permessi, limiti per ciclo e decision engine.
7. **Costi** — il costo reale dei token viene registrato (per agente e per giorno) e scalato dal capitale.
8. **Riproduzione** (Phase 5) — a capitale ≥ 2× l'iniziale: il padre cede €50 a un figlio che eredita lezioni, statistiche, osservazioni e un riassunto, con strategia mutata (stesso modello, nicchia vicina, rischio/esplorazione perturbati).
9. **Persistenza** — stato e log salvati e committati.

## Roadmap

| Fase | Cosa cambia | Spesa reale | Serve la tua conferma |
|---|---|---|---|
| **1 — Agente simulato** ✅ | tutto il loop, simulatore del mercato | solo Claude API (facoltativa, con tetto) | abilitare l'API |
| **2 — Ricerca reale** | `web_search`/`web_fetch` al posto di `scan/research/analyze`; osservazioni con fonti; mercato ancora simulato per i risultati | token + ricerche web | sì (costo API) |
| **3 — Attività digitali controllate** | tool `generate_content`, `generate_code` (workspace), `publish_landing_page`, `list_on_marketplace`, `send_outreach_message` con approvazione | Vercel/dominio | sì: account e ogni pubblicazione |
| **4 — Misurazione reale** | `read_analytics`, `read_payments` (Stripe restricted key), il ledger registra `real_money`; `simulateTick` sostituito dai dati reali | capitale reale deciso da te | sì: ogni spesa |
| **5 — Clonazione** | `REPRODUCTION_ENABLED=true`, `MAX_POPULATION>1` | come sopra | sì |
| **6 — Evoluzione multi-agente** | selezione per ROI, budget LLM ripartito, condivisione di conoscenza tra linee, dashboard (Vercel) | come sopra | sì |
