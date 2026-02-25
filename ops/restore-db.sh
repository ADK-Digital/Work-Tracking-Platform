#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
MINIO_SERVICE="${MINIO_SERVICE:-minio}"
INPUT_FILE="${1:-}"

if [[ -z "${INPUT_FILE}" ]]; then
  echo "Usage: $0 <backup-file.dump|backup-directory>"
  exit 1
fi

if [[ ! -f "${INPUT_FILE}" && ! -d "${INPUT_FILE}" ]]; then
  echo "Backup path not found: ${INPUT_FILE}"
  exit 1
fi

DB_BACKUP_FILE="${INPUT_FILE}"
MINIO_BACKUP_FILE=""

if [[ -d "${INPUT_FILE}" ]]; then
  DB_BACKUP_FILE="${INPUT_FILE}/postgres.dump"
  MINIO_BACKUP_FILE="${INPUT_FILE}/minio-data.tar.gz"
fi

if [[ ! -f "${DB_BACKUP_FILE}" ]]; then
  echo "Postgres backup file not found: ${DB_BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will overwrite database data in ${DB_SERVICE}."

docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < "${DB_BACKUP_FILE}"

if [[ -n "${MINIO_BACKUP_FILE}" ]]; then
  if [[ ! -f "${MINIO_BACKUP_FILE}" ]]; then
    echo "MinIO backup file not found: ${MINIO_BACKUP_FILE}"
    exit 1
  fi

  echo "Restoring MinIO data in ${MINIO_SERVICE}."
  docker compose -f "${COMPOSE_FILE}" exec -T "${MINIO_SERVICE}" sh -lc 'find /data -mindepth 1 -delete'
  docker compose -f "${COMPOSE_FILE}" exec -T "${MINIO_SERVICE}" sh -lc 'tar -C /data -xzf -' < "${MINIO_BACKUP_FILE}"
fi

echo "Restore completed."
