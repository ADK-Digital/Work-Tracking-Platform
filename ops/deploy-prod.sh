# Production deploys must use rootful Podman.
# Do not use plain `podman compose` as local-admin for production rebuilds,
# because the live stack and Postgres bind mount run under root context.

#!/bin/bash
set -euo pipefail

REPO_DIR="/var/home/local-admin/pm/bscsd-pm"

cd "$REPO_DIR"

echo "==> Repo: $(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is not installed or not in PATH"
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "ERROR: sudo is not available"
  exit 1
fi

if ! sudo command -v podman-compose >/dev/null 2>&1; then
  echo "ERROR: podman-compose is not available in root context"
  exit 1
fi

echo "==> Pulling latest code..."
git pull --ff-only

echo "==> Current commit:"
git log -1 --oneline

echo "==> Deploying with rootful Podman via podman-compose..."
echo "==> Command: sudo podman-compose -f docker-compose.prod.yml up -d --build"
sudo podman-compose -f docker-compose.prod.yml up -d --build

echo "==> Current container status:"
sudo podman ps

echo "==> Deployment complete"