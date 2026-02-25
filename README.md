# Special Projects Tracker

An internal Asana-lite style project with a **Vite + React + TypeScript** frontend prototype and a new **Node.js + Express + Prisma + Postgres** backend.

## Frontend (current behavior)

The frontend still uses browser `localStorage` for persistence in this phase.

```bash
npm install
npm run dev
```

## Backend setup (Phase 1)

### 1) Start Postgres with Docker

```bash
docker compose up -d
```

This starts a local Postgres instance on `localhost:5432`.

### 2) Install backend dependencies

```bash
cd server
npm install
```

### 3) Configure environment

```bash
cp .env.example .env
```

`DATABASE_URL` in `.env.example` is already configured to the local Docker Postgres service.

### 4) Run Prisma migration

```bash
npm run prisma:migrate -- --name init
```

### 5) Seed demo data

```bash
npm run seed
```

### 6) Run backend server

```bash
npm run dev
```

Backend runs at `http://localhost:3001`.

## API endpoints

- `GET /api/health`
- `GET /api/work-items?type=task|purchase_request&includeDeleted=false`
- `GET /api/work-items/:id`
- `POST /api/work-items`
- `PATCH /api/work-items/:id`
- `DELETE /api/work-items/:id` (soft delete)
- `GET /api/work-items/:id/activity`

## Quick curl examples

```bash
# Health
curl http://localhost:3001/api/health

# List non-deleted work items
curl http://localhost:3001/api/work-items

# List only tasks
curl "http://localhost:3001/api/work-items?type=task"

# Create a work item
curl -X POST http://localhost:3001/api/work-items \
  -H "Content-Type: application/json" \
  -d '{
    "type":"task",
    "title":"Follow up with design",
    "status":"todo",
    "owner":"Sam"
  }'

# Update a work item
curl -X PATCH http://localhost:3001/api/work-items/<WORK_ITEM_ID> \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'

# Soft delete a work item
curl -X DELETE http://localhost:3001/api/work-items/<WORK_ITEM_ID>

# View activity for a work item
curl http://localhost:3001/api/work-items/<WORK_ITEM_ID>/activity
```
