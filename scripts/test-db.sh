#!/usr/bin/env bash
# Prova lo schema su un Postgres 16 temporaneo: finto Supabase + migrazioni + test.
# Uso: scripts/test-db.sh   (serve Postgres installato in locale; non tocca Supabase)
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/postgres" ] || { echo "Postgres non trovato (imposta PG_BIN)"; exit 1; }

DIR="$(mktemp -d)"
chmod 777 "$DIR"
UTENTE_PG="$(id -un)"
esegui() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && UTENTE_PG=postgres

pulisci() { esegui "$PG_BIN/pg_ctl" -D "$DIR/dati" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap pulisci EXIT

esegui "$PG_BIN/initdb" -D "$DIR/dati" -U "$UTENTE_PG" -A trust >/dev/null
esegui "$PG_BIN/pg_ctl" -D "$DIR/dati" -o "-k $DIR -p 54329 -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null

PSQL=(esegui psql -h "$DIR" -p 54329 -U "$UTENTE_PG" -d postgres -v ON_ERROR_STOP=1 -q -X)
FILE=(supabase/tests/00_finto_supabase.sql supabase/migrations/*.sql supabase/tests/10_test_schema.sql)
for f in "${FILE[@]}"; do
  cp "$f" "$DIR/$(basename "$f")"
  "${PSQL[@]}" -f "$DIR/$(basename "$f")"
done
