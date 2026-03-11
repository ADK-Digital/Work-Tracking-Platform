BSCSD Project Manager Deployment Runbook

System Overview

Application: BSCSD Project Manager
Purpose: Internal project tracking system replacing Asana.

Architecture:

Frontend: React + Vite
Backend: Node.js + Express
Database: PostgreSQL
Object Storage: MinIO
Reverse Proxy: Nginx
Authentication: Google OAuth (Google Workspace)

Infrastructure:

Host: Ubuntu VM running in Hyper-V
Container Runtime: Docker Compose

Server Information

Hostname:
pm-server

Internal DNS:
pm-dev.bscsd.org

Server IP:
10.11.40.85

SSH User:
stefan

Repository

GitHub Organization:
Ballston-Spa-CSD

Repository:
bscsd-pm

Server Repo Path:
/home/stefan/pm-prod/ADK-Digital-Site

Local Repo Path:
C:\Users\snaumowicz\Github\bscsd-pm

Docker Services

Containers:

nginx
backend
postgres
minio

Check container status:

docker ps

Restart stack:

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

TLS Configuration

Certificates stored at:

/home/stefan/pm-prod/ADK-Digital-Site/nginx/certs/

Reverse proxy container:

adk-digital-site-nginx

Database Backups

Backup script:

/home/stefan/pm-backups/postgres/backup_postgres.sh

Backup directory:

/home/stefan/pm-backups/postgres/

Schedule:

02:00 daily via cron

Retention:

30 days

Restore example:

gunzip -c backup.sql.gz | docker exec -i adk-digital-site-db-1 psql -U tracker -d DATABASE_NAME

MinIO Backups

Backup script:

/home/stefan/pm-backups/minio/backup_minio.sh

Backup directory:

/home/stefan/pm-backups/minio/

Schedule:

02:15 daily via cron

Retention:

30 days

Secrets Management

The repository does not contain real secrets.

Sensitive values such as authentication credentials and session keys are stored only on the server.

The runtime production environment file exists only on the server:

/home/stefan/pm-prod/ADK-Digital-Site/server/.env.prod

This file contains the real values for:

SESSION_SECRET
GOOGLE_CLIENT_SECRET
database credentials
MinIO credentials

The repository version of server/.env.prod contains placeholder values and should never contain real secrets.

The server copy of server/.env.prod is marked with the git skip-worktree flag so that git pull operations do not overwrite it.

Google Workspace Authentication

Authentication is performed using Google OAuth.

Authorization is controlled through Google Workspace group membership.

Admin group used by the application:

cms-admins@bscsd.org

Users who belong to this group are automatically granted the admin role in the application.

The backend verifies group membership using the Google Workspace Admin Directory API.

Google Service Account Key

The service account used to query Google Workspace group membership is stored outside the repository.

Location on server:

/home/stefan/pm-prod/secrets/bscsd-cms-directory-reader.json

This key is mounted into the backend container using Docker Compose.

Mount path inside the container:

/run/secrets/bscsd-cms-directory-reader.json

The backend reads this key through the environment variable:

GOOGLE_SERVICE_ACCOUNT_JSON=/run/secrets/bscsd-cms-directory-reader.json

The key file must never be committed to Git.

Deployment Procedure

SSH into server:

ssh stefan@10.11.40.85

Update application:

cd ~/pm-prod/ADK-Digital-Site

git pull

Rebuild and restart the stack:

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

Verify containers:

docker ps

Git Authentication

Server uses SSH deploy key:

~/.ssh/bscsd_pm_deploy_key

Git remote:

git@github.com
:Ballston-Spa-CSD/bscsd-pm.git

Recovery Procedure

Restore PostgreSQL backup

Restore MinIO volume

Start Docker stack

Verify application access

Compose and Restart Notes

Use the full production compose file set for stack operations:

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

To view full production services:

docker compose -f docker-compose.yml -f docker-compose.prod.yml config --services

Important:

Do not rely on plain docker compose up -d without the production override file.

The host Ubuntu nginx service must remain disabled, or it will take port 80/443 and prevent the Docker nginx container from starting after reboot.

Disable host nginx if needed:

sudo systemctl disable --now nginx

Post-Reboot Validation

SSH into the server

Check containers:

docker ps

Confirm nginx has published ports:

docker port adk-digital-site-nginx-1

Expected:

80/tcp -> 0.0.0.0:80
443/tcp -> 0.0.0.0:443

Open:

https://pm-dev.bscsd.org

Verify login via Google SSO

Maintenance Tasks

Check backups:

ls ~/pm-backups/postgres
ls ~/pm-backups/minio

Check cron jobs:

crontab -l

Check container status:

docker ps

Troubleshooting

If the site is unreachable after reboot:

SSH into the server

Confirm host nginx is not running
sudo systemctl status nginx

Check containers
docker ps

If nginx container missing or unhealthy:

cd ~/pm-prod/ADK-Digital-Site

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx