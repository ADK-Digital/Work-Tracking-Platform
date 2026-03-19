#!/bin/bash
set -e

cd /var/home/local-admin/pm/bscsd-pm

echo "Pulling latest code..."
git pull

echo "Rebuilding and starting production stack..."
docker compose -f docker-compose.prod4.yml up -d --build

echo "Current container status:"
docker ps