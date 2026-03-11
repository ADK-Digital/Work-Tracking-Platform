# BSCSD Project Manager Deployment Runbook

## System Overview

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

---

## Server Information

Hostname:
pm-server

Internal DNS:
pm-dev.bscsd.org

Server IP:
10.11.40.85

SSH User:
stefan

---

## Repository

GitHub Organization:
Ballston-Spa-CSD

Repository:
bscsd-pm

Server Repo Path:
/home/stefan/pm-prod/ADK-Digital-Site

Local Repo Path:
C:\Users\snaumowicz\Github\bscsd-pm

---

## Docker Services

Containers:

nginx  
backend  
postgres  
minio

Check container status:

docker ps

Restart stack:

docker compose up -d

---

## TLS Configuration

Certificates stored at:

/home/stefan/pm-prod/ADK-Digital-Site/nginx/certs/

Reverse proxy container:

adk-digital-site-nginx

---

## Database Backups

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

---

## MinIO Backups

Backup script:

/home/stefan/pm-backups/minio/backup_minio.sh

Backup directory:

/home/stefan/pm-backups/minio/

Schedule:

02:15 daily via cron

Retention:

30 days

---

## Deployment Procedure

SSH into server:

ssh stefan@10.11.40.85

Update application:

cd ~/pm-prod/ADK-Digital-Site

git pull

docker compose up -d --build

Verify containers:

docker ps

---

## Git Authentication

Server uses SSH deploy key:

~/.ssh/bscsd_pm_deploy_key

Git remote:

git@github.com:Ballston-Spa-CSD/bscsd-pm.git

---

## Recovery Procedure

1. Restore PostgreSQL backup
2. Restore MinIO volume
3. Start Docker stack
4. Verify application access

---

## Maintenance Tasks

Check backups:

ls ~/pm-backups/postgres  
ls ~/pm-backups/minio  

Check cron jobs:

crontab -l

Check container status:

docker ps