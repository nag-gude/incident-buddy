# IncidentBuddy — Implementation Guide

Hands-on guide for running, verifying, and extending the project.

## Prerequisites

| Tool | Version |
| ---- | ------- |
| Python | 3.12+ |
| Node.js | 18+ |
| Optional | TrueFoundry AI Gateway or OpenAI API key |
| Optional | gcloud + Terraform for GCP Cloud Run production URL |

## Environment variables

Copy [`.env.example`](../.env.example) to `incident-buddy/.env` at the repo root.

### Core

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `DATABASE_PATH` | No | SQLite file (default `backend/data/incidentbuddy.db`) |
| `RUNBOOKS_DIR` | No | Markdown runbooks directory |
| `CORS_ORIGINS` | No | Comma-separated browser origins |
| `ADMIN_TOKEN` | No | Admin routes: header `X-Admin-Token` (default `dev-admin-change-me`) |
| `DEMO_TOKEN` | Prod | When set, mutating routes require header `X-Demo-Token` |
| `NAIVE_MODE` | No | `true` = brittle LLM path for before/after demo footage |

### LLM / TrueFoundry

| Variable | Description |
| -------- | ----------- |
| `TRUEFOUNDRY_GATEWAY_URL` | OpenAI-compatible gateway base URL |
| `TRUEFOUNDRY_API_KEY` | Gateway bearer token |
| `OPENAI_API_KEY` | Direct OpenAI fallback if no gateway |
| `OPENAI_MODEL` / `OPENAI_FALLBACK_MODEL` | Commercial fallback models |
| `PRIMARY_LLM_MODEL` | Primary route label (default `nvidia/nemotron`) |
| `PRIMARY_LLM_PROVIDER` | Transcript provider chip (default `crusoe-nemotron`) |

### Continuous demo loop (24/7 judging URL)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `DEMO_LOOP_ENABLED` | `true` | Master switch for background scheduler |
| `LOOP_INTERVAL_SECONDS` | `60` | Spawn new scenario on this cadence |
| `LOOP_STATE_STEP_SECONDS` | `15` | Advance incident state machine |
| `LOOP_GC_MAX_INCIDENTS` | `50` | Archive older incidents beyond cap |
| `LOOP_LIVE_LLM_IDLE_MINUTES` | `15` | Use live LLM only if judge pinged recently |
| `LOOP_MAX_CONCURRENT_INCIDENTS` | `2` | Cap open incidents from auto-loop |

### SSE

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `SSE_KEEPALIVE_SECONDS` | `15` | Ping interval for open SSE connections |
| `SSE_QUEUE_SIZE` | `256` | Per-subscriber queue depth |

### Frontend proxy

| Variable | When | Description |
| -------- | ---- | ----------- |
| `NEXT_PUBLIC_API_URL` | Local dev | Browser → backend (e.g. `http://127.0.0.1:8000`) |
| `BACKEND_URL` | Production | Next.js server proxy target (Cloud Run API URL) |

## Run locally

**Terminal 1 — API**

```bash
cd incident-buddy/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd .. && cp -n .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

**Terminal 2 — UI**

```bash
cd incident-buddy/frontend
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev
```

Open http://localhost:3000 → **Error rate (P1)** on the demo toolbar.

### Auth in development

| `DEMO_TOKEN` in `.env` | Behavior |
| ---------------------- | -------- |
| Empty | Mutating routes work without `X-Demo-Token` |
| Set | Open `http://localhost:3000?t=<token>` once; token is stored in `sessionStorage` |

Admin operations (chaos POST, demo reset, TrueFoundry replay) use the **`X-Admin-Token`** header. The UI **Admin token** field (persisted in `sessionStorage`) sends this automatically. Legacy JSON body `admin_token` still works for curl backward compatibility.

| Route group | Header | Dev default |
| ----------- | ------ | ----------- |
| Incident mutate (simulate, run-agent, comms, loop pause) | `X-Demo-Token` | Empty = gate off locally |
| Admin (chaos, reset, truefoundry-replay) | `X-Admin-Token` | `dev-admin-change-me` |

## Verify the stack

```bash
# Health
curl -s http://127.0.0.1:8000/healthz | jq

# Resilience status
curl -s http://127.0.0.1:8000/api/health/resilience | jq

# Golden-path incident
curl -s -X POST http://127.0.0.1:8000/api/demo/simulate-alert \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"error_rate"}' | jq

# Resilience score (replace INC id)
curl -s http://127.0.0.1:8000/api/incidents/INC-XXXX/resilience-score | jq

# Chaos: primary LLM down (body must include "flags" wrapper)
curl -s -X POST http://127.0.0.1:8000/api/admin/chaos \
  -H 'X-Admin-Token: dev-admin-change-me' \
  -H 'Content-Type: application/json' \
  -d '{"flags":{"llm_primary_down":true}}' | jq

# Demo reset
curl -s -X POST http://127.0.0.1:8000/api/demo/reset \
  -H 'X-Admin-Token: dev-admin-change-me' | jq

# TrueFoundry judge replay
curl -s -X POST http://127.0.0.1:8000/api/demo/truefoundry-replay \
  -H 'X-Admin-Token: dev-admin-change-me' | jq

# Pause loop (when DEMO_TOKEN set, add -H 'X-Demo-Token: ...')
curl -s -X POST http://127.0.0.1:8000/api/admin/loop/pause | jq

# SSE (Ctrl+C to exit)
curl -N http://127.0.0.1:8000/api/events

# Loop status
curl -s http://127.0.0.1:8000/api/admin/loop/status | jq
```

### Unit tests

```bash
cd incident-buddy/backend
source .venv/bin/activate
pytest tests/ -q
```

## Backend layout

```
backend/app/
├── main.py              FastAPI app, lifespan (DB + scheduler)
├── config.py            Pydantic settings
├── db.py                Schema, migrations (archived, source columns)
├── auth.py              DEMO_TOKEN + X-Admin-Token helpers
├── routers/
│   ├── alerts.py        Webhook ingest
│   ├── incidents.py     CRUD, agent, comms, resilience endpoints
│   ├── demo.py          Simulate + reset
│   ├── admin.py         Chaos flags
│   ├── loop.py          Pause/resume/status
│   ├── events.py        SSE stream + session ping
│   └── health.py
└── services/
    ├── incident_service.py
    ├── agent_orchestrator.py
    ├── mcp_adapter.py
    ├── llm_gateway.py
    ├── resilience.py    Score, pulse, chaos timeline
    ├── redaction.py     PII/key stripping before LLM
    ├── chaos.py
    ├── scheduler.py     APScheduler jobs
    ├── event_bus.py     In-process pub/sub for SSE
    └── loop_state.py    Pause flag + judge session tracking
```

## Frontend layout

```
frontend/
├── app/                 Next.js App Router pages
├── components/
│   ├── IncidentLiveDashboard.tsx   Pulse, score, failover, evidence
│   ├── EvidenceCard.tsx            Human-readable summaries
│   ├── LiveSession.tsx             SSE + session ping
│   └── ...
└── lib/
    ├── apiClient.ts       fetch + auth + errors
    ├── useIncidentStream.ts
    ├── demoToken.ts
    └── evidenceFormat.ts
```

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| Frontend empty incidents | Check `NEXT_PUBLIC_API_URL` / `BACKEND_URL` and backend port |
| CORS errors | Add origin to `CORS_ORIGINS` |
| Simulate 401 | Set `DEMO_TOKEN` in `.env` and open app with `?t=` |
| LLM always template | Set gateway or `OPENAI_API_KEY`; or chaos flags forcing template |
| Chaos / reset 401 | Match `ADMIN_TOKEN` in UI Admin token field and `.env`; send `X-Admin-Token` header |
| SSE shows Reconnecting | Ensure backend running; check proxy forwards `/api/events` |
| Loop spawns too many incidents | `POST /api/admin/loop/pause` before recording |
| Docker: empty incidents / 404 on detail | Rebuild UI (`docker compose up --build`); SSR must use `BACKEND_URL`, not host port 3000 inside the container |

## Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for GCP Cloud Run topology, Secret Manager, and health checks.

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, resilience flows, data model
- [DEPLOYMENT.md](./DEPLOYMENT.md) — GCP Cloud Run, Docker, local dev
- [README.md](../README.md) — judging URL and hackathon tracks
