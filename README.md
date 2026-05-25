# IncidentBuddy

**Your on-call partner that doesn't quit when the tools do.**

![IncidentBuddy Thumbnail](assets/Thumbnail.png)


![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)


## The problem

Engineers are paged for symptoms, then spend **15–45 minutes** collecting context across PagerDuty, Grafana, deploy logs, and Slack — while stakeholders ask for updates. When **MCP tools or LLMs fail during an incident**, fragile agents make the situation worse.

## What IncidentBuddy does

| Capability | Role |
| ---------- | ---- |
| **Alert ingest** | Webhook + demo simulate for `payments-api` |
| **MCP evidence** | Mock metrics, deploys, prior incidents — persisted bundles with live/cached badges |
| **Agent orchestrator** | Triage → gather → analyze → plan → draft comms |
| **TrueFoundry-ready LLM** | OpenAI-compatible gateway + fallback + template mode |
| **Chaos panel** | Toggle MCP/LLM failures for resilience demo |
| **HITL comms** | Approve/reject Slack draft before mock post |
| **Resilience UX** | Pulse bar, failover animation, resilience score, reasoning stream, **live recovery log**, **gateway trace**, **resilience matrix** |

## Architecture

```
Browser (Next.js) ──► /api/* proxy ──► FastAPI ──► SQLite
                              │              ├── MCP mock adapters
                              │              ├── Agent orchestrator
                              │              └── LLM gateway (TrueFoundry / OpenAI)
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for system context, sequences, data model, and resilience design.

## Repository structure

```
incident-buddy/
├── docker-compose.yml     Local Docker stack
├── deploy/                Dockerfiles
├── terraform/             GCP Cloud Run + Artifact Registry
├── scripts/               deploy scripts
├── assets/
├── runbooks/
├── backend/
├── frontend/
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md         ← GCP Cloud Run (primary) + Docker + local
    ├── IMPLEMENTATION.md     ← Auth, demo flow, curl cheatsheet
```

## Deployment

| Mode | Guide |
| ---- | ----- |
| **GCP Cloud Run** | [docs/DEPLOYMENT.md §1](docs/DEPLOYMENT.md#1-production--gcp-cloud-run) — Secret Manager + `make gcp-deploy` or [GitHub Actions](.github/workflows/README.md) |
| **Docker (local)** | `make up` → [docs/DEPLOYMENT.md §3](docs/DEPLOYMENT.md#3-local-docker-stack) |
| **Dev (no Docker)** | Below |

### Production on GCP (judging URL)

1. `export GCP_PROJECT_ID=your-project`  
2. `./scripts/gcp-create-secrets.sh` — tokens and API keys in **Secret Manager**  
3. Copy `terraform/terraform.tfvars.example` → `terraform/terraform.tfvars` (project_id + secret IDs only)  
4. `make gcp-deploy` (or [Console UI](docs/DEPLOYMENT.md#16-deploy-via-google-cloud-console-ui))  
5. Submit `terraform output frontend_url` to Devpost (add `?t=<DEMO_TOKEN>` from your demo-token secret)

The API runs APScheduler in-process; set `min_instance_count = 1` in Terraform so the demo loop stays warm between judge visits. SQLite lives at `/tmp` on Cloud Run (ephemeral if the instance is replaced).

**Judging URL:**

```
https://<frontend-cloud-run-url>?t=<DEMO_TOKEN>
```

**Pause the loop for a demo video:**

```bash
curl -X POST -H "X-Demo-Token: $DEMO_TOKEN" https://<backend_url>/api/admin/loop/pause
curl -X POST -H "X-Demo-Token: $DEMO_TOKEN" https://<backend_url>/api/admin/loop/resume
```

## Quick start (development)

### 1. Backend

```bash
cd incident-buddy
cp .env.example .env
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 2. Frontend

```bash
cd incident-buddy/frontend
npm install
export NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

Open http://localhost:3000 → click **Error rate (P1)** on the demo toolbar.

### 3. Optional: TrueFoundry / OpenAI

Set in `.env` at repo root (backend loads via `app/config.py`):

```bash
TRUEFOUNDRY_GATEWAY_URL=https://your-gateway.example/v1
TRUEFOUNDRY_API_KEY=...
OPENAI_API_KEY=sk-...
PRIMARY_LLM_MODEL=nvidia/nemotron
PRIMARY_LLM_PROVIDER=crusoe-nemotron
```

Without keys, the agent uses **template analysis** and still completes the demo.

For auth (`DEMO_TOKEN`, `ADMIN_TOKEN`), SSE, loop tuning, demo video checklist, and curl smoke tests, see **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)**.

### Tests

```bash
cd backend && source .venv/bin/activate && pytest tests/ -q
```

## Judging URL (TrueFoundry demo)

1. Open the app with `?t=<DEMO_TOKEN>` when auth is enabled.
2. Home → check **Resilience matrix** (all green) and **Resilience status** strip.
3. Click **TrueFoundry judge demo** (admin token) or manually: **Error rate (P1)** → Chaos `llm_primary_down` → **Re-run analysis** → `mcp_metrics_down` → **Re-run**.
4. Pause the background loop before recording: **Admin** (`/admin`) → **Pause loop**, or `POST /api/admin/loop/pause` (see curl above).

**Judge cheatsheet**

| Token | Purpose | How to use |
| ----- | ------- | ---------- |
| `DEMO_TOKEN` | Mutating incident routes | URL `?t=<token>` → stored as `X-Demo-Token` header |
| `ADMIN_TOKEN` | Reset, chaos, TrueFoundry replay | UI admin token field → `X-Admin-Token` header (default dev: `dev-admin-change-me`) |

| Action | UI | API |
| ------ | -- | --- |
| Pause auto-spawn | `/admin` → Pause loop | `POST /api/admin/loop/pause` + `X-Demo-Token` |
| Chaos / resilience demo | `/admin/chaos` | `POST /api/admin/chaos` + `X-Admin-Token` |
| One-click TrueFoundry path | Home → **TrueFoundry judge demo** | `POST /api/demo/truefoundry-replay` + `X-Admin-Token` |
| Live SSE | Nav **Live ●** | `GET /api/events` |

```bash
# Admin replay (local dev default admin token)
curl -X POST http://localhost:8000/api/demo/truefoundry-replay \
  -H "X-Admin-Token: dev-admin-change-me"
```

Chaos **LLM tiers are mutually exclusive**: enabling `llm_all_down` clears `llm_primary_down` (template mode wins). Incident `degraded_flags` are normalized on read so you never see both “Backup LLM” and “AI offline” at once.

The background loop rotates five scenarios (`payments-api` P1/P2, `checkout-api` P1, `auth-service` P3) every **60 seconds** (configurable via `LOOP_INTERVAL_SECONDS`). **Restart the API** after changing loop env vars.


## API highlights

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/demo/simulate-alert` | Golden-path demo — `scenario` enum: `error_rate`, `latency`, `saturation`, `checkout_errors`, `auth_timeouts` |
| GET | `/api/incidents` | List incidents |
| GET | `/api/incidents/{id}` | Full detail |
| POST | `/api/incidents/{id}/run-agent` | Re-run agent analysis (demo token) |
| POST | `/api/incidents/{id}/approve-comms` | Approve comms — `{}` resolves latest pending draft; 422 if none pending |
| POST | `/api/incidents/{id}/reject-comms` | Reject pending comms — same optional body shape |
| GET | `/api/incidents/{id}/resilience-state` | Pulse state + chaos timeline |
| POST | `/api/demo/reset` | Reset demo (`X-Admin-Token` header) |
| POST | `/api/admin/chaos` | Chaos toggles (`X-Admin-Token` header) |
| POST | `/api/demo/truefoundry-replay` | Full judge demo sequence (`X-Admin-Token` header) |
| GET | `/api/incidents/{id}/logs` | Live recovery log tail |
| GET | `/api/incidents/{id}/gateway-trace` | TrueFoundry gateway call trace |
| GET | `/api/logs/global` | System / loop ops log |
| GET | `/api/health/resilience` | Gateway + chaos status |
| GET | `/api/events` | SSE stream — incident, agent, loop events |
| POST | `/api/events/ping` | Judge-session ping (used by frontend on mount) |
| GET | `/api/admin/loop/status` | Loop + scheduler + subscriber snapshot |
| POST | `/api/admin/loop/pause` | Pause the chaos loop (demo token) |
| POST | `/api/admin/loop/resume` | Resume the chaos loop (demo token) |
| GET | `/healthz` | Liveness probe (Cloud Run) |

## Hackathon tracks

| Track | Fit |
| ----- | --- |
| **TrueFoundry Resilient Agents** | Primary — chaos + gateway fallbacks |
| **Overall** | Secondary — Progress / Concept / Feasibility |
| Perfect Corp | Not applicable |

## License

MIT — see [LICENSE](LICENSE).
