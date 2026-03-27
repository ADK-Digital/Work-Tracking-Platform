#!/bin/bash
set -e

cd /var/home/local-admin/pm/bscsd-pm

echo "Pulling latest code..."
git pull

echo "Rebuilding and starting production stack..."
sudo podman-compose -f docker-compose.prod.yml up -d --build

echo "Current container status:"
sudo podman ps