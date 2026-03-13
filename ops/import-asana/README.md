# Asana CSV Import

This folder contains the Asana import script for validating CSV exports and importing them into the BSCSD Project Manager database.

## Script

- `import-asana-dry-run.ts`

## What it does

- Reads these CSV files from `/home/stefan/asana-import/`:
  - `Break_Project_List.csv`
  - `Budgeting_&_Purchases.csv`
  - `Task_Tracking.csv`
  - `Team_Coordination_&_Tasks.csv`
- Skips rows where `Completed At` is populated.
- Applies ownership rules:
  - Purchase requests always map to `jlamora@bscsd.org`.
  - Tasks with blank `Assignee Email` fall back to `aperuzzi@bscsd.org` and append `Imported from Asana without an assignee.` to the description.
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
cd /workspace/bscsd-pm
npx tsx ops/import-asana/import-asana-dry-run.ts
```

Execute mode:

```bash
cd /workspace/bscsd-pm
npx tsx ops/import-asana/import-asana-dry-run.ts --execute
```

Notes:

- Ensure backend environment variables are available (for `DATABASE_URL`, owner directory settings, etc.).
- The script checks env files in this order: `/home/stefan/pm-prod/secrets/server.env.prod`, `/home/stefan/pm-prod/secrets/server.env.prod.runtime`, `/home/stefan/pm-prod/ADK-Digital-Site/server/.env.prod`, `server/.env.prod`, `.env.backend`, then `server/.env`.
- Existing process environment variables are preserved and not overwritten by file-loaded values.
