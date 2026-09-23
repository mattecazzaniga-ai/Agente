# Agente — agenti economici autonomi

Infrastruttura per agenti AI autonomi con capitale, obiettivo, memoria e strategia, che eseguono da soli il ciclo
**RESEARCH → ANALYZE → PLAN → ACT → MEASURE → LEARN → REPEAT** per generare ricavi con attività digitali legittime.

**Stato: Phase 1** — un agente reale (loop, strumenti, decision engine, memoria, contabilità, sicurezza, scheduler 24/7)
che opera in un **mercato simulato con denaro virtuale** (€50 iniziali, obiettivo €100). Il cervello è Claude (se abiliti
l'API) oppure un cervello euristico offline gratuito.

- Architettura, costi, rischi, schema e roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Cosa configurare a mano: [docs/SETUP.md](docs/SETUP.md)

```bash
npm install && npm test
npm run cli -- init
npm run cli -- simulate 168   # una settimana simulata, offline
npm run cli -- status
```

Principi: l'LLM propone, il codice dispone (limiti deterministici, filtro di policy, permessi per strumento, approvazione
umana sopra soglia); nessun denaro reale in Phase 1; il costo reale di Claude è scalato dal capitale; tutto è loggato e
versionato.
