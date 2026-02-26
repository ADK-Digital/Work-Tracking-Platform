#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-.env.frontend}"
SERVER_ENV_FILE="${SERVER_ENV_FILE:-server/.env.prod}"
BASE_URL="${SMOKE_TEST_BASE_URL:-http://localhost}"
HEALTH_TIMEOUT_SECONDS="${SMOKE_TEST_TIMEOUT_SECONDS:-180}"
RETRY_INTERVAL_SECONDS="${SMOKE_TEST_RETRY_INTERVAL_SECONDS:-3}"
FRESH=false

usage() {
  cat <<'USAGE'
Usage: ./ops/prod-smoke-test.sh [--fresh] [--help]

Runs a production compose smoke test:
  - starts docker compose stack
  - waits for /api/health and /api/ready
  - verifies MinIO bucket initialization
  - optionally validates authenticated endpoints when SMOKE_TEST_SESSION_COOKIE is provided
  - optionally uploads a test attachment when both SMOKE_TEST_SESSION_COOKIE and SMOKE_TEST_WORK_ITEM_ID are provided

Options:
  --fresh   Destructive reset: runs `docker compose down -v` before startup.
  --help    Show this help.

Useful env overrides:
  COMPOSE_FILE, FRONTEND_ENV_FILE, SERVER_ENV_FILE, SMOKE_TEST_BASE_URL,
  SMOKE_TEST_TIMEOUT_SECONDS, SMOKE_TEST_RETRY_INTERVAL_SECONDS,
  SMOKE_TEST_SESSION_COOKIE, SMOKE_TEST_WORK_ITEM_ID
USAGE
}

log() {
  printf '[smoke] %s\n' "$*"
}

warn() {
  printf '[smoke][WARN] %s\n' "$*"
}

fail() {
  printf '[smoke][FAIL] %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

load_env_file() {
  local env_file="$1"
  local env_label="$2"

  if [[ -f "$env_file" ]]; then
    log "Loading ${env_label} variables from ${env_file}"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  else
    warn "${env_label} file not found at ${env_file}; relying on already-exported environment variables"
  fi
}

wait_for_endpoint_200() {
  local endpoint="$1"
  local start_ts now status
  start_ts="$(date +%s)"

  while true; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${endpoint}" || true)"
    if [[ "$status" == "200" ]]; then
      log "${endpoint} returned HTTP 200"
      return 0
    fi

    now="$(date +%s)"
    if (( now - start_ts >= HEALTH_TIMEOUT_SECONDS )); then
      fail "Timed out waiting for ${endpoint} (last status: ${status:-unreachable})"
    fi

    log "Waiting for ${endpoint} (status: ${status:-unreachable})"
    sleep "$RETRY_INTERVAL_SECONDS"
  done
}

verify_minio_bucket() {
  local minio_init_id minio_exit_code

  minio_init_id="$(docker compose -f "$COMPOSE_FILE" ps -a -q minio-init)"
  if [[ -z "$minio_init_id" ]]; then
    fail "minio-init container not found; cannot verify bucket initialization"
  fi

  minio_exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$minio_init_id")"
  if [[ "$minio_exit_code" != "0" ]]; then
    docker compose -f "$COMPOSE_FILE" logs minio-init --tail=120 || true
    fail "minio-init exited with code ${minio_exit_code}"
  fi

  if [[ -z "${S3_BUCKET:-}" ]]; then
    warn "S3_BUCKET is not set; skipping direct bucket directory check"
    return 0
  fi

  if docker compose -f "$COMPOSE_FILE" exec -T minio sh -lc "test -d /data/${S3_BUCKET}"; then
    log "Verified MinIO bucket directory exists: /data/${S3_BUCKET}"
  else
    docker compose -f "$COMPOSE_FILE" logs minio --tail=120 || true
    fail "Expected MinIO bucket directory missing: /data/${S3_BUCKET}"
  fi
}

authenticated_checks() {
  local cookie_header="Cookie: ${SMOKE_TEST_SESSION_COOKIE}"

  log "Running authenticated checks with provided SMOKE_TEST_SESSION_COOKIE"

  curl -fsS -H "$cookie_header" "${BASE_URL}/api/me" >/dev/null
  log "Authenticated /api/me check succeeded"

  curl -fsS -H "$cookie_header" "${BASE_URL}/api/work-items" >/dev/null
  log "Authenticated /api/work-items check succeeded"

  if [[ -n "${SMOKE_TEST_WORK_ITEM_ID:-}" ]]; then
    local temp_file
    temp_file="$(mktemp)"
    printf 'smoke-test attachment %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$temp_file"

    curl -fsS -X POST \
      -H "$cookie_header" \
      -F "file=@${temp_file};type=text/plain" \
      "${BASE_URL}/api/work-items/${SMOKE_TEST_WORK_ITEM_ID}/attachments" >/dev/null

    rm -f "$temp_file"
    log "Attachment upload check succeeded for work item ${SMOKE_TEST_WORK_ITEM_ID}"
  else
    warn "SMOKE_TEST_WORK_ITEM_ID not set; skipping attachment upload check"
  fi
}

while (($# > 0)); do
  case "$1" in
    --fresh)
      FRESH=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

require_command docker
require_command curl

load_env_file "$SERVER_ENV_FILE" "server"

if [[ -f "$FRONTEND_ENV_FILE" ]]; then
  log "Using compose env file ${FRONTEND_ENV_FILE}"
  COMPOSE_ENV_ARGS=(--env-file "$FRONTEND_ENV_FILE")
else
  warn "Frontend env file not found at ${FRONTEND_ENV_FILE}; using current environment for compose build args"
  COMPOSE_ENV_ARGS=()
fi

if [[ "$FRESH" == true ]]; then
  warn "--fresh provided: removing containers and volumes (destructive)"
  docker compose "${COMPOSE_ENV_ARGS[@]}" -f "$COMPOSE_FILE" down -v
fi

log "Starting production stack"
docker compose "${COMPOSE_ENV_ARGS[@]}" -f "$COMPOSE_FILE" up -d --build

wait_for_endpoint_200 "/api/health"
wait_for_endpoint_200 "/api/ready"
verify_minio_bucket

if [[ -n "${SMOKE_TEST_SESSION_COOKIE:-}" ]]; then
  authenticated_checks
else
  warn "SMOKE_TEST_SESSION_COOKIE not set; skipping authenticated API checks and attachment upload"
fi

log "PASS: production compose smoke test completed successfully"
