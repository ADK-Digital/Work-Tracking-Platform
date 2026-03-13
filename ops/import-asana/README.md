# Asana CSV Dry-Run Import

This folder contains a dry-run import script for validating Asana CSV exports against the BSCSD Project Manager schema.

## Script

- `import-asana-dry-run.ts`

## What it does

- Reads these CSV files from `/home/stefan/asana-import/`:
  - `Break_Project_List.csv`
  - `Budgeting_&_Purchases.csv`
  - `Task_Tracking.csv`
  - `Team_Coordination_&_Tasks.csv`
- Skips rows where `Completed At` is populated.
- Maps fields into in-memory `WorkItem` payloads and corresponding `ActivityEvent` payloads.
- Validates owners against the same Google Directory/mock owner source used by the app.
- Reports task `projectName` values that would need to be created in `TaskProjectOption`.
- Prints summary counts, skipped rows, and mapped owners.
- Does **not** write anything to the database.

## Run locally on the server

From the repository root:

```bash
cd /workspace/bscsd-pm
npx tsx ops/import-asana/import-asana-dry-run.ts
```

Notes:

- Ensure backend environment variables are available (for `DATABASE_URL`, owner directory settings, etc.).
- The script checks env files in this order: `/home/stefan/pm-prod/secrets/server.env.prod`, `/home/stefan/pm-prod/secrets/server.env.prod.runtime`, `/home/stefan/pm-prod/ADK-Digital-Site/server/.env.prod`, `server/.env.prod`, `.env.backend`, then `server/.env`.
- Existing process environment variables are preserved and not overwritten by file-loaded values.
