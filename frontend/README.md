# Frontend — IncidentBuddy UI

API proxy uses **`next.config.mjs` rewrites** (`/api/*` → `BACKEND_URL`). There is no `app/api/` folder — the previous `app/api/[[...path]]` catch-all broke Devpost/GitHub folder uploads because of `[` and `]` in the directory name.

```bash
# Local dev with same-origin proxy
BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

For Devpost/manual upload: run `make package-frontend` from the repo root (never upload `node_modules` or `.next`).
