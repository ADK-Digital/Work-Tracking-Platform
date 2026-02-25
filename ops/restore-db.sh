#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
INPUT_FILE="${1:-}"

if [[ -z "${INPUT_FILE}" ]]; then
  echo "Usage: $0 <backup-file.dump>"
  exit 1
fi

if [[ ! -f "${INPUT_FILE}" ]]; then
  echo "Backup file not found: ${INPUT_FILE}"
  exit 1
fi

echo "WARNING: This will overwrite database data in ${DB_SERVICE}."

docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < "${INPUT_FILE}"

echo "Restore completed."
