#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${1:-${BACKUP_DIR}/postgres-backup-${TIMESTAMP}.dump}"

mkdir -p "${BACKUP_DIR}"

echo "Creating backup at ${OUTPUT_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${OUTPUT_FILE}"
echo "Backup completed."
