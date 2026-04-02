# Special Projects Tracker — Master Handbook

## 1. System Overview
The Special Projects Tracker is an internal web application used to manage Purchase Requests and Tasks/Projects.

Architecture:
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Object Storage: MinIO
- Reverse Proxy: NGINX
- Authentication: Google OAuth
- Container Runtime: Podman

Note: Some filenames still reference Docker (e.g., docker-compose.prod.yml).

---

## 2. System Location & Access
Server:
- Host: pm-server
- DNS: pm-dev.bscsd.org

Repository path:
/var/home/local-admin/pm/bscsd-pm

---

## 3. User Guide
Login via Google SSO.

Work Items:
- Purchase Requests
- Tasks / Projects

Fields:
- Title, Description, Status, Owner, Attachments, Comments, Activity

Dashboard Filters:
- Type, Status, Owner, Project, Search

Attachments:
- Multi-upload supported
- Paperclip icon indicates presence

Export:
- CSV, XLSX, JSON
- Filterable
- Downloads locally

---

## 4. Admin Guide
Admins can:
- Create/edit/delete/restore items
- Export data

Admin group:
cms-admins@bscsd.org

---

## 5. Developer Guide
DO NOT edit code on server.

Workflow:
1. Develop locally
2. Push to GitHub
3. Deploy:

ssh stefan@pm-server
cd /var/home/local-admin/pm/bscsd-pm
./ops/deploy-prod.sh

---

## 6. Infrastructure
Containers:
- nginx
- backend
- db
- minio

Check:
sudo podman ps

Health:
- /api/health
- /api/ready

---

## 7. Backup & Recovery
Script:
/var/home/local-admin/pm/bscsd-pm/ops/backup-db.sh

Location:
/var/home/local-admin/pm-backups/

Contains:
- postgres.dump
- minio-data.tar.gz

Runs daily via systemd.
Retention: 30 days.

---

## 8. Operations
Check containers:
sudo podman ps

Check backups:
ls /var/home/local-admin/pm-backups

Check timer:
systemctl --user list-timers | grep pm-backup

---

## 9. Troubleshooting
Check containers:
sudo podman ps

Check logs:
sudo podman logs nginx

---

## 10. Rules
DO NOT:
- Edit code on server
- Store secrets in repo

ALWAYS:
- Use deploy-prod.sh
- Verify backups

---

## 11. Summary
Production-ready, backed up, maintainable system.
