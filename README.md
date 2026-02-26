# Special Projects Tracker

An internal Asana-lite style project with a **Vite + React + TypeScript** frontend prototype and a **Node.js + Express + Prisma + Postgres** backend.

## Frontend modes

- **Default mode (`localStorage`)**: no backend required.
- **API mode**: enabled with `VITE_USE_API=true` and points to the backend at `VITE_API_BASE_URL`.

### Frontend environment variables

- `VITE_USE_API` (`"true" | "false"`) — default: `"false"`
- `VITE_API_BASE_URL` — default: `"http://localhost:3001"`

## Frontend quick start (default localStorage mode)

```bash
npm install
npm run dev
```

## Backend + API mode setup

### 1) Start Postgres with Docker

```bash
docker compose up -d
```

### 2) Install backend dependencies

```bash
cd server
npm install
```

### 3) Configure backend environment

```bash
cp .env.example .env
```

`DATABASE_URL` in `.env.example` is already configured to the local Docker Postgres service.

For Google Workspace SSO, also configure:

- `SESSION_SECRET` (long random string)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (e.g. `http://localhost:3001/auth/google/callback`)
- `ALLOWED_EMAIL_DOMAINS` (comma-separated, e.g. `yourdistrict.org`)
- `ALLOWED_USER_GROUPS` (optional, comma-separated Google Group emails that are allowed to use the app)
- `ADMIN_GROUPS` (optional, comma-separated Google Group emails that map to admin role)
- `ADMIN_EMAILS` (optional fallback allowlist for admin users during early rollout)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (optional: service account JSON string or file path)
- `GOOGLE_IMPERSONATE_ADMIN_EMAIL` (optional: Workspace admin email for domain-wide delegation)
- `GOOGLE_WORKSPACE_CUSTOMER_ID` (optional; reserved for future Admin SDK lookups)
- `FRONTEND_URL` (frontend origin, default `http://localhost:5173`)
- `TRUST_PROXY` (`true`, `false`, or proxy hop count; defaults to `1` in production and `0` in development)
- `RATE_LIMIT_WINDOW_MS` (optional API rate-limit window in milliseconds, default `900000`)
- `RATE_LIMIT_MAX` (optional API rate-limit max requests per IP per window, default `100`)

### 3a) Create a Google OAuth client (Web application)

1. In Google Cloud Console, open **APIs & Services → Credentials**.
2. Create an **OAuth client ID** of type **Web application**.
3. Add authorized redirect URI(s), including your callback URL (for local dev: `http://localhost:3001/auth/google/callback`).
4. Copy the generated client ID and secret into `server/.env`.
5. Ensure user emails are in an allowed domain listed in `ALLOWED_EMAIL_DOMAINS`.

### 4) Run migration, seed, and backend

```bash
npm run prisma:migrate
npm run seed
npm run dev
```

> Migrations now include a `Comment` table used for per-work-item discussion threads.

Backend runs at `http://localhost:3001`.

## CI build gate (backend)

Pull requests and pushes to `main` must pass this backend CI contract from `server/`:

```bash
npm ci
npx prisma generate
npm run build
```

This gate ensures dependency installation is deterministic, Prisma client generation succeeds without a database connection, and the TypeScript compile remains healthy.

## Authorization setup (RBAC)

### Simplest mode (early rollout)

Use email/domain checks plus an admin allowlist:

- `ALLOWED_EMAIL_DOMAINS=yourdistrict.org`
- `ADMIN_EMAILS=admin1@yourdistrict.org,admin2@yourdistrict.org`

In this mode, any authenticated user in an allowed domain gets `role: "user"`, and listed admin emails get `role: "admin"`.

### Production mode (Google Groups)

Use Google Admin Directory group membership checks:

- `ALLOWED_USER_GROUPS` (optional) limits app access to members of at least one group.
- `ADMIN_GROUPS` grants admin role to members of at least one admin group.
- `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_IMPERSONATE_ADMIN_EMAIL` enable server-side group membership lookups.

The backend uses Domain-Wide Delegation with a service account and impersonated admin, and requests:

- `https://www.googleapis.com/auth/admin.directory.group.member.readonly`

If group env vars are not set, the app falls back to domain + `ADMIN_EMAILS` behavior.

### Rollout checklist

1. Set `ALLOWED_EMAIL_DOMAINS`.
2. Set `ADMIN_GROUPS` (or `ADMIN_EMAILS` for initial rollout).
3. Verify `GET /api/me` returns `{ email, name, role }`.
4. Verify a non-admin receives `403 { "message": "Forbidden" }` on protected mutations.
5. Verify an admin can create, update, and delete work items.
6. Verify activity entries still capture actor email after admin mutations.

### 5) Run frontend in API mode

In a separate terminal (project root):

```bash
npm install
VITE_USE_API=true VITE_API_BASE_URL=http://localhost:3001 npm run dev
```

> Note: default frontend behavior remains `localStorage` unless `VITE_USE_API=true` is set.

## API endpoints

- `GET /auth/google`
- `GET /auth/google/callback`
- `POST /auth/logout`
- `GET /api/health`
- `GET /api/ready`
- `GET /api/me` (requires auth)
- returns `{ email, name, role }`
- `GET /api/work-items?type=task|purchase_request&includeDeleted=false`
- `GET /api/work-items/:id`
- `POST /api/work-items` (**admin only**)
- `PATCH /api/work-items/:id` (**admin only**)
- `DELETE /api/work-items/:id` (soft delete, **admin only**)
- `POST /api/work-items/:id/restore` (**admin only**)
- `GET /api/work-items/:id/activity`
- `GET /api/work-items/:id/comments`
- `POST /api/work-items/:id/comments`
- `DELETE /api/comments/:commentId` (**admin only**, soft delete)
- `GET /api/work-items/:id/attachments`
- `POST /api/work-items/:id/attachments` (multipart form field `file`, allowed authenticated users)
- `GET /api/attachments/:attachmentId/download`
- `DELETE /api/attachments/:attachmentId` (**admin only**, soft delete)
- `GET /api/search?q=:query&type=task|purchase_request&status=:status&owner=:owner&includeDeleted=true|false&limit=50`
  - searches across work item fields (`title`, `description`, `status`, `owner`, `createdBy`, `updatedBy`, `type`), comments (`body`, `authorEmail`), and activity (`message`, `actor`)
  - also supports UUID-style `q` (exact work item id) and `YYYY-MM-DD` `q` (matches work item `createdAt` date)
  - `includeDeleted=true` is **admin-only**; non-admin requests are rejected with 403
  - includes attachment filename matches once attachments are enabled
- `GET /api/export/work-items?type=task|purchase_request&includeDeleted=true|false` (**admin only**)
- `GET /api/export/activity?workItemId=:id` (**admin only**)

> In API mode, all `/api/*` endpoints except `/api/health` and `/api/ready` require an authenticated Google Workspace session.

Attachment upload policy defaults:
- JSON and URL-encoded request body size limit: `1 MB`
- Max file size: `25 MB` (`ATTACHMENT_MAX_SIZE_BYTES`)
- Allowed MIME types are controlled by `ATTACHMENT_ALLOWED_TYPES`


## Internal deployment (Docker Compose + NGINX)

This repository includes production-style packaging for internal hosting:

- `server/Dockerfile` for the Node/Express backend
- `nginx/Dockerfile` + `nginx/nginx.conf` to build the Vite frontend and serve static assets via NGINX
- `docker-compose.prod.yml` for `db`, `minio`, `backend`, and `nginx`

### 1) Prepare env files

```bash
cp server/.env.prod.example server/.env.prod
cp .env.frontend.example .env.frontend
```

Update values in `server/.env.prod` with real secrets and your hostnames.

Set MinIO and S3-compatible attachment variables in `server/.env.prod`:
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `S3_ENDPOINT=http://minio:9000`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE=true`

MinIO console is exposed internally on port `9001` within the compose network for optional internal access.

### 2) Build and run

```bash
docker compose --env-file .env.frontend -f docker-compose.prod.yml up -d --build
```

### 3) Verified production runbook (fresh DB + MinIO + backup/restore)

Use this checklist exactly for zero-to-running validation with clean volumes:

```bash
# 0) one-time env setup
cp server/.env.prod.example server/.env.prod
cp .env.frontend.example .env.frontend

# 1) reset to fresh state
docker compose -f docker-compose.prod.yml down -v

# 2) bring up full stack and build images
docker compose --env-file .env.frontend -f docker-compose.prod.yml up -d --build

# 3) verify public health and readiness through NGINX
curl -fsS http://localhost/api/health
curl -fsS http://localhost/api/ready

# 4) verify backend startup applied migrations deterministically
docker compose -f docker-compose.prod.yml logs backend --tail=200

# 5) verify OAuth callback expectation (must match Google OAuth client redirect URI)
# expected path: /auth/google/callback

# 6) verify MinIO bucket exists and is reachable
docker compose -f docker-compose.prod.yml exec -T minio sh -lc 'ls -la /data'

# 7) create backup artifacts (postgres + minio)
./ops/backup-db.sh

# 8) restore from a selected backup directory into the running stack
./ops/restore-db.sh ./backups/backup-YYYYMMDD-HHMMSS
```

The production backend startup command runs `prisma migrate deploy` before serving requests. This means fresh databases are migrated during container startup with no extra manual Prisma commands.

### 4) OAuth callback URL for proxied deployment

When using NGINX as the public entrypoint, your Google OAuth callback URL must match the proxied URL:

- `https://your-internal-host/auth/google/callback`

Also set:

- `FRONTEND_URL=https://your-internal-host`
- `GOOGLE_CALLBACK_URL=https://your-internal-host/auth/google/callback`

### 5) Secure cookies and TLS

Production sessions are configured for secure cookie behavior behind a proxy (`trust proxy` + secure cookies). For secure cookies to work correctly, terminate TLS at NGINX or at an upstream load balancer that forwards `X-Forwarded-Proto=https`.

### 6) Public health/readiness

These endpoints are intentionally unauthenticated for monitoring:

- `GET /api/health`
- `GET /api/ready`


## Backups

Database backup/restore scripts for the production Docker Compose stack are in `ops/` and target `docker-compose.prod.yml`.

### Create a backup

```bash
./ops/backup-db.sh
```

```powershell
./ops/backup-db.ps1
```

Backups are written to `./backups/backup-<timestamp>/` with:

- `postgres.dump`
- `minio-data.tar.gz`

### Restore from backup

```bash
./ops/restore-db.sh ./backups/backup-YYYYMMDD-HHMMSS
```

```powershell
./ops/restore-db.ps1 -InputFile ./backups/backup-YYYYMMDD-HHMMSS
```

> ⚠️ Warning: restore overwrites existing database data. When restoring from a backup directory, MinIO object data is also replaced.

### Scheduling recommendation

Run backup script nightly using:

- `cron` on Linux/macOS
- Windows Task Scheduler on Windows

## Production rollout acceptance checks

- App loads at `/`.
- Auth login redirects to Google and returns correctly.
- `/api/me` works after login.
- Non-admin users cannot `POST`/`PATCH`/`DELETE` work items.
- `/api/health` and `/api/ready` are available without auth.
- Restarting containers preserves DB data via the `postgres_data` volume.
