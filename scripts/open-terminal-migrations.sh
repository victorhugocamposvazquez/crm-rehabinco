#!/usr/bin/env bash
# Abre Terminal.app con psql; la contraseña se escribe en esa ventana (no en el chat).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="${PSQL:-/usr/local/opt/libpq/bin/psql}"
if [[ ! -x "$PSQL" ]]; then PSQL="/opt/homebrew/opt/libpq/bin/psql"; fi

HOST="${SUPABASE_DB_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
PORT="${SUPABASE_DB_PORT:-5432}"
USER="${SUPABASE_DB_USER:-postgres.ohwcnfigexzgqpmwmbib}"

FILES=("$@")
if [[ ${#FILES[@]} -eq 0 ]]; then
  FILES=(
    supabase/migrations/20260925200000_captacion_rafagas_locks_cron.sql
    supabase/migrations/20260925210000_reencolar_telefonos_fallidos.sql
    supabase/migrations/20260926100000_captacion_telefono_estados.sql
  )
fi

FARGS=""
for f in "${FILES[@]}"; do
  [[ -f "$ROOT/$f" ]] || { echo "No existe: $f" >&2; exit 1; }
  FARGS+=" -f \\\"$ROOT/$f\\\""
done

CMD="cd \\\"$ROOT\\\" && \\\"$PSQL\\\" \\\"host=$HOST port=$PORT dbname=postgres user=$USER sslmode=require\\\" -v ON_ERROR_STOP=1${FARGS}"

osascript -e 'tell application "Terminal" to activate' -e "tell application \"Terminal\" to do script \"$CMD\""
echo "Terminal abierta. Escribe la contraseña de Postgres en esa ventana."
