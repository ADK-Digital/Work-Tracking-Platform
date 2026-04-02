# Work Tracking Platform — Master Handbook

## 1. System Overview
The Work Tracking Platform is an internal work tracking application used to manage projects and requests.

Architecture:
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Object Storage: MinIO
- Reverse Proxy: NGINX
- Authentication: Google OAuth
- Container Runtime: Podman

Note: Some filenames still reference Docker (for example, `docker-compose.prod.yml`).

---

## 2. System Location & Access
Server and DNS values are environment-specific and should be provided by each institution.

Repository path:
Set this to your institution's deployment path.

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
Set via your environment configuration (`ADMIN_GROUPS` / `ADMIN_EMAILS`).

---

## 5. Developer Guide
DO NOT edit code on server.

Workflow:
1. Develop locally
2. Push to GitHub
3. Deploy using the supported entrypoint:

```bash
./ops/deploy-prod.sh
```

---

## 6. Infrastructure
Containers:
- nginx
- backend
- db
- minio

Check:
```bash
sudo podman ps
```

Health:
- `/api/health`
- `/api/ready`

---

## 7. Backup & Recovery
Backups exist in this system and are run operationally.

Note:
- Backup strategy is environment-specific and intentionally out of scope for this template-conversion pass.

---

## 8. Operations
Check containers:
```bash
sudo podman ps
```

---

## 9. Troubleshooting
Check containers:
```bash
sudo podman ps
```

Check logs:
```bash
sudo podman logs nginx
```

---

## 10. Rules
DO NOT:
- Edit code on server
- Store secrets in repo

ALWAYS:
- Use `deploy-prod.sh`
- Follow your institution's backup verification process

---

## 11. Summary
Production-ready internal work tracking application with environment-specific deployment and operations.
