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

Backend runs at `http://localhost:3001`.

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
- `GET /api/work-items/:id/activity`

> In API mode, all `/api/*` endpoints except `/api/health` and `/api/ready` require an authenticated Google Workspace session.

## Internal deployment (Docker Compose + NGINX)

This repository includes production-style packaging for internal hosting:

- `server/Dockerfile` for the Node/Express backend
- `nginx/Dockerfile` + `nginx/nginx.conf` to build the Vite frontend and serve static assets via NGINX
- `docker-compose.prod.yml` for `db`, `backend`, and `nginx`

### 1) Prepare env files

```bash
cp server/.env.prod.example server/.env.prod
cp .env.frontend.example .env.frontend
```

Update values in `server/.env.prod` with real secrets and your hostnames.

### 2) Build and run

```bash
docker compose --env-file .env.frontend -f docker-compose.prod.yml up -d --build
```

### 3) OAuth callback URL for proxied deployment

When using NGINX as the public entrypoint, your Google OAuth callback URL must match the proxied URL:

- `https://your-internal-host/auth/google/callback`

Also set:

- `FRONTEND_URL=https://your-internal-host`
- `GOOGLE_CALLBACK_URL=https://your-internal-host/auth/google/callback`

### 4) Secure cookies and TLS

Production sessions are configured for secure cookie behavior behind a proxy (`trust proxy` + secure cookies). For secure cookies to work correctly, terminate TLS at NGINX or at an upstream load balancer that forwards `X-Forwarded-Proto=https`.

### 5) Public health/readiness

These endpoints are intentionally unauthenticated for monitoring:

- `GET /api/health`
- `GET /api/ready`

## Production rollout acceptance checks

- App loads at `/`.
- Auth login redirects to Google and returns correctly.
- `/api/me` works after login.
- Non-admin users cannot `POST`/`PATCH`/`DELETE` work items.
- `/api/health` and `/api/ready` are available without auth.
- Restarting containers preserves DB data via the `postgres_data` volume.
