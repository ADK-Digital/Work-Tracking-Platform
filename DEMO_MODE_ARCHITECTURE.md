# Demo Mode Architecture Seam (Frontend)

## Purpose

This pass introduces a minimal-risk architecture seam so the frontend can support multiple runtime modes in a future pass while preserving existing production behavior by default.

Current mode options:
- `standard` (default): existing Google-authenticated, backend-driven behavior
- `demo`: frontend-only, session-scoped behavior with seeded synthetic data

## What Was Introduced

### 1) App mode configuration

- New file: `src/config/appMode.ts`
- `APP_MODE` is derived from `VITE_APP_MODE`
- Any unknown or unset value falls back to `standard`

This makes production behavior the default and keeps mode-switch logic centralized.

### 2) Frontend auth provider seam

- New file: `src/providers/auth/authProvider.ts`
- Added `AuthProvider` interface:
  - `getCurrentUser()`
  - `signOut()`
  - `getSignInUrl()`

Implementations:
- `standardAuthProvider`: current real `/api/me`, `/auth/logout`, `/auth/google`
- `demoAuthProvider` (placeholder): fixed demo user, no-op sign-out, no sign-in URL

Usage updates:
- `Dashboard` and `WorkItemDetailPage` now use `getAuthProvider()` instead of directly coupling to auth endpoints.
- `Header`/`AppShell` now accept a `signInUrl` prop so sign-in behavior is provider-driven rather than hardcoded to Google.

### 3) Frontend work-items data provider seam

- New file: `src/providers/data/workItemsDataProvider.ts`
- Added `WorkItemsDataProvider` interface covering existing work-item API operations used by UI flows.

Implementations:
- `standardWorkItemsDataProvider`: delegates to existing `workItemsService`
- `demoWorkItemsDataProvider`: uses browser `sessionStorage` + in-memory cache and never calls backend endpoints

Seed location:
- `src/providers/data/demo/demoSeed.ts`

Usage updates:
- `Dashboard`, `WorkItemDetailPage`, `PurchaseRequestsWidget`, and `TasksWidget` now call `getWorkItemsDataProvider()` for core work-item CRUD and related operations.

## Coupling Found During Inspection

### Google auth coupling points
- Sign-in link hardcoded to `/auth/google` in header UI.
- Pages directly calling auth endpoints (`/api/me`, `/auth/logout`) through service helpers.

### Backend API coupling points
- UI pages/widgets directly depended on `workItemsService` methods, which map one-to-one to backend API behavior.
- Owner directory loading still directly uses `ownerDirectoryService` and backend response shapes.
- Export in `Dashboard` still uses direct fetch to backend export endpoint.

## Production Behavior Preservation

- Default `APP_MODE` remains `standard`.
- `standard` providers call the same endpoints and service logic previously used.
- No backend API contract changes.
- No database schema changes.
- No deployment script changes.

## Demo Session Storage Lifecycle

### Storage mechanism

- Demo work-item state is stored under a single key in `sessionStorage`:
  - `demo_work_items_store`
- Persisted store includes:
  - work items
  - comments
  - activity log events
  - attachment metadata
  - task/project option values

### Initialization and rehydration

- On first load in a browser tab/session:
  - provider deep-clones `DEMO_WORK_ITEMS_SEED` + related demo seed collections
  - writes the resulting state to `sessionStorage`
- On subsequent operations in the same session:
  - provider reads from in-memory cache/sessionStorage
  - every mutation writes the full updated state back to `sessionStorage`
- If storage data is missing, malformed, or shape-invalid:
  - provider automatically reinitializes from seed and continues

### Reset behavior

- Demo data is intentionally **session-scoped**:
  - closing the tab/window ends the browser session
  - opening a new session starts from seed data again
- No `localStorage` usage, so demo data never persists across sessions.

## Current Demo Provider Behavior

- Fully local CRUD in demo mode for:
  - `getWorkItems`
  - `getWorkItemById`
  - `createWorkItem`
  - `updateWorkItem`
  - `completeWorkItem`
  - `softDeleteWorkItem`
  - `restoreWorkItem`
- Additional local support for:
  - comments (`listComments`, `addComment`, `softDeleteComment`)
  - activity (`listActivity`, mutation event appends)
  - attachments metadata (`listAttachments`, `uploadAttachment`, `deleteAttachment`)
  - task/project options and local search

## Guidance for Institutions That Do Not Want Demo Mode

Institutions can ignore demo mode entirely by:
- Leaving `VITE_APP_MODE` unset (defaults to `standard`), or explicitly setting `VITE_APP_MODE=standard`.
- Optionally deleting demo-specific provider files (`demoAuthProvider`, demo data seed/provider paths) while retaining standard provider wiring.

This keeps the same production runtime behavior while preserving a clean seam for organizations that do want demo capability later.
