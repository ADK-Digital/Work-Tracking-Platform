# Asana CSV Import

> ⚠️ This was a one-time migration script, it has already been run successfully, and it should not be run again.

This folder contains an archived one-time Asana migration script used to import CSV exports into the work tracking database.

## Script

- `archive/import-asana-2026-asana-migration.ts` (archived; do not run)

## What it does

- Reads these CSV files from an import directory (historically `/home/<deploy-user>/asana-import/`):
  - `Break_Project_List.csv`
  - `Budgeting_&_Purchases.csv`
  - `Task_Tracking.csv`
  - `Team_Coordination_&_Tasks.csv`
- Skips rows where `Completed At` is populated.
- Applies ownership rules from the migration runbook, including fallback owner handling when an assignee email was missing.
- Resolves owners against the same Google Directory/mock owner source used by the app.
- Ensures task `projectName` values are persisted and that required `TaskProjectOption` values exist.
- Creates one `ActivityEvent` (`type=created`, `message="Imported from Asana"`, `actor="asana-import"`) for each imported work item.

## Safety flag

The script requires `--execute` to perform database writes.

- Without `--execute`: dry run only (no writes).
- With `--execute`: writes to the database.

The script always prints an `About to import X records` line before write execution.

## Run locally on the server

From the repository root:

```bash
cd /workspace/<repo-name>
npx tsx ops/import-asana/archive/import-asana-2026-asana-migration.ts
```

Execute mode (historical reference only; do not run again):

```bash
cd /workspace/<repo-name>
npx tsx ops/import-asana/archive/import-asana-2026-asana-migration.ts --execute
```

Notes:

- Ensure backend environment variables are available (for `DATABASE_URL`, owner directory settings, etc.).
- The script checks several env files, then falls back to `server/.env.prod`, `.env.backend`, and `server/.env`.
- Existing process environment variables are preserved and not overwritten by file-loaded values.
