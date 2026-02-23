# Special Projects Tracker (Frontend Prototype)

An internal Asana-lite style prototype built with **Vite + React + TypeScript + Tailwind CSS**.

## Run locally

```bash
npm install
npm run dev
```

## Data persistence

- Data is stored in browser `localStorage` under key: `special-projects-tracker-work-items`.
- On first load, seed demo data is automatically inserted if the key is missing.
- All reads/writes go through `src/services/workItemsService.ts`.

## Reset demo data

Use the **Reset Demo Data** button in the header. This calls `resetDemoData()` in the service and reloads both widgets.

## Extending with more widgets

- Add new widgets in `src/components/widgets/`.
- Reuse `WidgetCard` (`src/components/widgets/WidgetCard.tsx`) for consistent framing.
- Keep filtering/sorting and persistence in service functions (`workItemsService`) so widgets stay focused on UI.
