#!/bin/bash
set -e

cd /home/stefan/pm-prod/ADK-Digital-Site

echo "Pulling latest code..."
git pull

echo "Rebuilding and starting production stack..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "Current container status:"
docker ps
