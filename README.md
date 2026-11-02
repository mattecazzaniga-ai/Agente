# BeachPick (nome provvisorio)

Notizie e pronostici di beach tennis: web app mobile-first (PWA) in italiano, portoghese brasiliano, spagnolo e inglese.
**Gioco di pronostici gratuito, nessuna scommessa o vincita in denaro.** Solo punti virtuali: niente denaro, premi o conversioni.

Architettura, schema e regole dei punti: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md). Come mettere l'app online: [docs/DEPLOY.md](docs/DEPLOY.md).

## Cosa c'è
- **Notizie**: titolo e riassunto di 3 righe scritti a mano (mai copiati), fonte e link all'articolo originale, in 4 lingue.
- **Calendario tornei** ITF / FIP / BR con stato (in programma, in corso, concluso) e filtri.
- **Pronostici** su ogni partita (chi vince, set, game totali) e sul torneo (vincitore e finalista facoltativo). Si chiudono all'inizio.
- **Punti "equi" secondo la rarità**: chi indovina una scelta fatta da pochi prende di più, da metà a due volte e mezzo i punti base. Le percentuali di voto si vedono solo dopo la chiusura.
- **Classifiche mensili**: globale, per Paese, tra amici (lega privata con codice o link d'invito).
- **Login** con email (codice a 6 cifre) o Google; profilo con nickname e Paese.
- **Pannello admin** protetto. Contiene:
  - tornei e tabelloni;
  - **importazione della entry list incollata**, che crea giocatori, coppie, primo turno e BYE;
  - risultati, con avanzamento automatico nel tabellone e punti calcolati da soli;
  - giocatori, notizie e cruscotto con utenti attivi a settimana rispetto all'obiettivo di 500.
- **Condivisione**: immagine PNG del pronostico o della posizione in classifica, per WhatsApp o Instagram.

I dati sportivi si inseriscono a mano: nessuna API, nessuno scraping.

## Sviluppo in locale
Serve Node 20+, Docker e la [Supabase CLI](https://supabase.com/docs/guides/cli).
```bash
npm install
supabase start            # Postgres, Auth e Mailpit in locale; applica le migrazioni e carica supabase/seed.sql (dati inventati)
cp .env.example .env.local
npm run dev               # http://localhost:3000
```
- I codici di accesso arrivano a Mailpit: http://127.0.0.1:54324.
- Per diventare admin:
  `docker exec supabase_db_beachpick psql -U postgres -c "update profili set is_admin = true where nickname = 'tuo_nick'"`

## Test
| Comando | Cosa prova |
|---|---|
| `npm test` | lettura delle entry list e costruzione del primo turno (vitest) |
| `npm run test:db` | lo schema su un Postgres temporaneo: permessi, blocchi, punti a rarità, avanzamento, classifiche, leghe, notizie, account |
| `npm run typecheck` / `npm run lint` / `npm run build` | tipi, lint, build di produzione |
| `npm run test:e2e` | da telefono (viewport iPhone): registrazione → lingua → pronostico → lega → classifica in meno di 2 minuti, poi l'admin che importa un tabellone, inserisce un risultato e pubblica una notizia. Richiede `supabase start` e `npm run build && npm start` |
