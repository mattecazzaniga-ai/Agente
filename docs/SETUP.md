# Configurazione manuale

Cosa devi fare tu (il resto è già nel repository).

## A. Provarlo in locale (nessun costo)

```bash
npm install
npm test                        # 15 test
npm run cli -- init             # crea Agent #001 con €50 virtuali
npm run cli -- tick             # un ciclo (cervello euristico se non c'è ANTHROPIC_API_KEY)
npm run cli -- simulate 168     # una settimana simulata in pochi secondi
npm run cli -- status
npm run cli -- report agent-001
```

I dati locali finiscono in `data/` (ignorata da git). Per ricominciare: `rm -rf data`.

## B. Esecuzione autonoma 24/7 su GitHub Actions (costo €0)

1. **Branch di default.** Lo scheduler di GitHub esegue solo i workflow presenti sul branch di default: fai il merge di questo lavoro su `main` (o impostalo come default).
2. **Permessi del workflow.** Settings → Actions → General → *Workflow permissions* → **Read and write permissions** (serve per committare lo stato sul branch `agent-state`).
3. **Accensione.** Settings → Secrets and variables → Actions → tab *Variables* → New variable:
   - `AGENT_ENABLED` = `true`
4. Primo avvio manuale (facoltativo): Actions → **agent** → Run workflow → command `tick`.

Da quel momento il ciclo gira ogni ora a :17. Lo stato è sul branch `agent-state` (`state.json` + `log/`), ogni run è un commit: storico completo, rollback con un revert.

### Controllo da telefono / browser
Actions → **agent** → Run workflow:

| command | args | effetto |
|---|---|---|
| `status` | | stato di agenti ed esperimenti (nel riepilogo del run) |
| `report` | `agent-001` | memoria, lezioni, esperimenti |
| `log` | `50` | ultimi eventi |
| `pause` / `resume` | `agent-001` | pausa / ripresa |
| `kill` | `agent-001 motivo` | kill switch per agente (permanente) |
| `killswitch` | `on motivo` / `off` | kill switch globale |
| `approvals` | | richieste in attesa |
| `approve` / `deny` | `apr-exp-0003` | decidi una richiesta |

**Stop immediato senza commit:** variabile `AGENT_KILL_SWITCH` = `1`, oppure `AGENT_ENABLED` = `false` (ferma lo scheduler).

## C. Abilitare Claude come cervello (⚠ SPESA REALE — richiede la tua conferma)

Senza questi passi l'agente usa il cervello euristico gratuito.

1. Crea una API key su console.anthropic.com e imposta **un limite di spesa mensile** sull'account (Settings → Limits): è la tua protezione di ultimo livello.
2. Settings → Secrets and variables → Actions:
   - Secret `ANTHROPIC_API_KEY` = la chiave
   - Variable `LLM_ENABLED` = `true`
   - (facoltative) `MAX_LLM_USD_PER_DAY` (default `1`), `AGENT_MODEL` (default `claude-opus-5`; `claude-sonnet-5` costa circa il 60% in meno), `AGENT_EFFORT` (default `medium`)
3. Il costo di ogni ciclo compare nel riepilogo del run e in `status`; viene anche scalato dal capitale virtuale dell'agente.

In locale: copia `.env.example` in `.env` e compila le stesse variabili.

## D. Parametri di sicurezza

Tutti in `src/config.ts`, sovrascrivibili via variabili d'ambiente (elenco completo in `.env.example`). Per cambiarli su GitHub aggiungi la variabile nel workflow `agent.yml` (sezione `env`) e in Settings → Variables.
