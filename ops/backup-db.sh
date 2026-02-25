#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
MINIO_SERVICE="${MINIO_SERVICE:-minio}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${1:-${BACKUP_DIR}/backup-${TIMESTAMP}}"
DB_OUTPUT_FILE="${OUTPUT_DIR}/postgres.dump"
MINIO_OUTPUT_FILE="${OUTPUT_DIR}/minio-data.tar.gz"

mkdir -p "${OUTPUT_DIR}"

echo "Creating PostgreSQL backup at ${DB_OUTPUT_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${DB_OUTPUT_FILE}"

echo "Creating MinIO backup at ${MINIO_OUTPUT_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T "${MINIO_SERVICE}" sh -lc 'tar -C /data -czf - .' > "${MINIO_OUTPUT_FILE}"

echo "Backup completed: ${OUTPUT_DIR}"
