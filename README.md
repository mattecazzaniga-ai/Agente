# BeachPick (nome provvisorio)

Notizie e pronostici di beach tennis: web app mobile-first in italiano, portoghese brasiliano, spagnolo e inglese.
Gioco di pronostici gratuito, nessuna scommessa o vincita in denaro.

**Stato: FASE 1 — schema del database e architettura.** Vedi [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

## Provare lo schema in locale
Serve Postgres (16 consigliato) installato sul computer; non tocca nessun progetto Supabase.
```bash
scripts/test-db.sh
```
Crea un database temporaneo, carica un'imitazione minima di Supabase (`supabase/tests/00_finto_supabase.sql`), la migrazione e i test (`supabase/tests/10_test_schema.sql`): permessi, blocco dei pronostici, calcolo dei punti, classifiche, leghe, notizie, metriche, eliminazione dell'account.

## Applicare lo schema su Supabase
1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. *SQL Editor* → incolla ed esegui `supabase/migrations/20261102000000_schema.sql` (oppure `supabase db push` con la CLI).
3. Registrati nell'app, poi nominati admin dal SQL Editor:
   `update profili set is_admin = true where id = (select id from auth.users where email = 'tua@email.it');`
