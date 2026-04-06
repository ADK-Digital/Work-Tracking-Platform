# Demo Mode Architecture Seam (Frontend)

## Purpose

This pass introduces a minimal-risk architecture seam so the frontend can support multiple runtime modes in a future pass while preserving existing production behavior by default.

Current mode options:
- `standard` (default): existing Google-authenticated, backend-driven behavior
- `demo` (placeholder): scaffolded extension points only

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
- `demoWorkItemsDataProvider` (placeholder): currently delegates to standard while marking demo seam

Placeholder seed location:
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

## Recommended Next Pass

1. **Implement demo data provider behavior**
   - Add in-memory/session-scoped store for work items, comments, attachments metadata, and activity.
   - Start from `DEMO_WORK_ITEMS_SEED` and clone per browser session.

2. **Session-scoped persistence model**
   - Recommended: keep demo state in-memory in the browser (or `sessionStorage`) keyed by a demo session identifier.
   - On reset (manual control or new session), rehydrate from seed data.
   - Avoid cross-user persistence; demo state should never write to production backend.

3. **Expand non-core providers as needed**
   - Introduce owner-directory provider and export provider seams if demo mode needs synthetic owners or local export behavior.

4. **UI affordances for demo mode**
   - Optional demo banner and reset control.
   - Ensure visual indication that data is synthetic.

## Guidance for Institutions That Do Not Want Demo Mode

Institutions can ignore demo mode entirely by:
- Leaving `VITE_APP_MODE` unset (defaults to `standard`), or explicitly setting `VITE_APP_MODE=standard`.
- Optionally deleting demo-specific provider files (`demoAuthProvider`, demo data seed/provider paths) while retaining standard provider wiring.

This keeps the same production runtime behavior while preserving a clean seam for organizations that do want demo capability later.
