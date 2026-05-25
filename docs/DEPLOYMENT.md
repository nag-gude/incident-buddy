# IncidentBuddy — Deployment Guide

Canonical guide for deploying IncidentBuddy on **Google Cloud Platform (GCP)**.

| Topology | When to use |
| -------- | ----------- |
| **1. Production — Cloud Run** | Public judging URL, HTTPS, Terraform or Console UI |
| **2. Local dev** | Fast iteration with `uvicorn` + `npm run dev` |
| **3. Local Docker** | Full-stack smoke test before GCP |

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [IMPLEMENTATION.md](./IMPLEMENTATION.md)


## 1. Production — GCP Cloud Run

Both the **FastAPI API** and **Next.js UI** run as Cloud Run services in one GCP project. Images are stored in **Artifact Registry**; infrastructure is defined in [`terraform/`](../terraform/).

```
Browser ──► Cloud Run (incident-buddy-ui) ──► /api/* rewrite ──► Cloud Run (incident-buddy-api)
                                                                      │
                                                                      ├── APScheduler (in-process)
                                                                      ├── SQLite @ /tmp/incidentbuddy.db
                                                                      └── TrueFoundry / OpenAI gateway
```

### 1.1 Why Cloud Run fits this app

| Property | IncidentBuddy behavior |
| -------- | ---------------------- |
| **Containers** | `deploy/Dockerfile.backend` and `deploy/Dockerfile.frontend` |
| **Background loop** | APScheduler in the API process — needs **min instances ≥ 1** or accepts cold-start gaps |
| **SQLite** | Default `DATABASE_PATH=/tmp/incidentbuddy.db` — **ephemeral** on Cloud Run; survives while instances stay warm |
| **SSE** | `/api/events` — set request timeout **300s** (already in Terraform) |
| **Single worker** | API Dockerfile pins `--workers 1` — do not scale API above one instance without splitting the scheduler |

**Persistence trade-off:** Cloud Run has no attached disk. For a hackathon demo with `min_instance_count = 1`, SQLite usually survives between judge visits. If the service scales to zero or the instance is replaced, incident history resets. For durable production data, use **Cloud SQL** or **Turso** (not required for submission).

### 1.2 Secret Manager (required before deploy)

Tokens and API keys are **not** stored in `terraform.tfvars`. Terraform mounts them from **Secret Manager** into the API service (see [`terraform/secrets.tf`](../terraform/secrets.tf)).

| Secret ID (default) | Cloud Run env var |
| ------------------- | ----------------- |
| `incidentbuddy-admin-token` | `ADMIN_TOKEN` |
| `incidentbuddy-demo-token` | `DEMO_TOKEN` |
| `incidentbuddy-truefoundry-gateway-url` | `TRUEFOUNDRY_GATEWAY_URL` |
| `incidentbuddy-truefoundry-api-key` | `TRUEFOUNDRY_API_KEY` |
| `incidentbuddy-openai-api-key` | `OPENAI_API_KEY` (optional; set `mount_openai_api_key = true`) |

**Option A — helper script:**

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
chmod +x scripts/gcp-create-secrets.sh
./scripts/gcp-create-secrets.sh
```

**Option B — gcloud:**

```bash
openssl rand -hex 16   # use for ADMIN_TOKEN and DEMO_TOKEN

echo -n "YOUR_ADMIN_TOKEN" | gcloud secrets create incidentbuddy-admin-token --data-file=- \
  --replication-policy=automatic || \
  echo -n "YOUR_ADMIN_TOKEN" | gcloud secrets versions add incidentbuddy-admin-token --data-file=-

# Repeat for incidentbuddy-demo-token, incidentbuddy-truefoundry-gateway-url,
# incidentbuddy-truefoundry-api-key, and optionally incidentbuddy-openai-api-key
```

**Option C — Console UI:** **Security** → **Secret Manager** → **Create secret** → add a **version** with the value. Use the secret IDs above (or override names in `terraform.tfvars`).

Terraform grants the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on these secrets automatically.

### 1.3 Prerequisites

| Requirement | Notes |
| ----------- | ----- |
| **GCP project** | Billing enabled — [console.cloud.google.com](https://console.cloud.google.com) |
| **gcloud CLI** | [Install](https://cloud.google.com/sdk/docs/install) → `gcloud auth login` |
| **Docker** | Local builds for `scripts/gcp-push-images.sh` (or use Cloud Build — [§1.6](#16-deploy-via-google-cloud-console-ui)) |
| **Terraform** | `>= 1.3` — [Install](https://developer.hashicorp.com/terraform/install) |
| **LLM keys** | TrueFoundry gateway URL + API key and/or OpenAI fallback |

**IAM roles** for the account running Terraform or pushing images:

| Role | Purpose |
| ---- | ------- |
| Artifact Registry Writer | Push Docker images |
| Cloud Run Admin | Create/update services |
| Service Usage Consumer | Enable APIs |
| Project IAM Admin | Grant `allUsers` invoker when `allow_unauthenticated = true` |

Enable APIs (Terraform does this automatically):

- `run.googleapis.com`
- `artifactregistry.googleapis.com`
- `secretmanager.googleapis.com`

### 1.4 One-command deploy (Terraform + scripts)

From the **repository root**, after configuring Terraform variables:

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
gcloud config set project "$GCP_PROJECT_ID"

cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit: project_id, secret IDs (if renamed), min_instance_count, mount_openai_api_key

./scripts/gcp-create-secrets.sh   # once per project

chmod +x scripts/gcp-deploy.sh scripts/gcp-push-images.sh
./scripts/gcp-deploy.sh
```

What `gcp-deploy.sh` does:

1. `terraform apply` — Artifact Registry only  
2. Build & push **backend** image  
3. Deploy **API** Cloud Run service  
4. Read `backend_url` → build **frontend** with `BACKEND_URL` (required for `/api` rewrites)  
5. `terraform apply` — deploy **UI** and public IAM  

**Outputs:**

```bash
cd terraform
terraform output frontend_url   # Devpost / judging URL
terraform output backend_url    # Swagger at /docs
```

**Verify:**

```bash
curl "$(terraform output -raw backend_url)/healthz"
curl "$(terraform output -raw backend_url)/api/admin/loop/status"
```

Expect `{"status":"ok"}` and `scheduler_running: true`.

### 1.5 Step-by-step deploy (Makefile)

Equivalent manual flow:

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export IMAGE_TAG="$(git rev-parse --short HEAD)"   # optional immutable tag

cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# edit terraform.tfvars

make tf-init
cd terraform && terraform apply -target=google_artifact_registry_repository.incident_buddy

make push-gcp   # requires BACKEND_URL only if pushing frontend; see below
```

**Phase 1 — API only:**

```bash
./scripts/gcp-push-images.sh --backend-only
cd terraform
terraform apply -target=google_cloud_run_v2_service.backend \
  -target=google_cloud_run_v2_service_iam_member.backend_public
export BACKEND_URL="$(terraform output -raw backend_url)"
```

**Phase 2 — UI (must set `BACKEND_URL` at Docker build):**

```bash
cd ..
BACKEND_URL="$BACKEND_URL" ./scripts/gcp-push-images.sh --frontend-only
cd terraform && terraform apply
```

> **Important:** The Next.js `/api/*` rewrite is baked into the frontend image at **build** time (`deploy/Dockerfile.frontend` + `next.config.mjs`). Runtime `BACKEND_URL` on Cloud Run covers **SSR** only. If you change the API URL, rebuild and push the frontend image, then redeploy the UI service.

### 1.6 Deploy via Google Cloud Console (UI)

Use this if you prefer the GCP web UI over local Terraform.

#### A. Project and APIs

1. [console.cloud.google.com](https://console.cloud.google.com) → select or **Create project**.  
2. **Billing** linked to the project.  
3. **APIs & Services** → **Library** → enable **Cloud Run API** and **Artifact Registry API**.

#### B. Artifact Registry

1. **Artifact Registry** → **Create repository**.  
2. Name: `incident-buddy`, format **Docker**, region `europe-west2` (match `terraform.tfvars`).  
3. Note the registry URL: `europe-west2-docker.pkg.dev/PROJECT/incident-buddy`.

#### C. Build and push images

On your laptop (with Docker + gcloud):

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth configure-docker europe-west2-docker.pkg.dev

# Backend
docker build -f deploy/Dockerfile.backend \
  -t europe-west2-docker.pkg.dev/PROJECT/incident-buddy/incident-buddy-backend:latest .
docker push europe-west2-docker.pkg.dev/PROJECT/incident-buddy/incident-buddy-backend:latest
```

Deploy the **API** first (step D), copy its HTTPS URL, then build the **frontend**:

```bash
export BACKEND_URL=https://incident-buddy-api-XXXX.europe-west2.run.app
docker build -f deploy/Dockerfile.frontend --build-arg BACKEND_URL="$BACKEND_URL" \
  -t europe-west2-docker.pkg.dev/PROJECT/incident-buddy/incident-buddy-frontend:latest .
docker push europe-west2-docker.pkg.dev/PROJECT/incident-buddy/incident-buddy-frontend:latest
```

**Alternative — Cloud Build (UI):** **Cloud Build** → **Triggers** → connect GitHub → add build steps that run the `docker build` / `docker push` commands above (set substitution `_BACKEND_URL` after the API URL exists).

#### D. Cloud Run — API service

1. **Cloud Run** → **Create service**.  
2. **Deploy one revision from an existing container image** → select `incident-buddy-backend:latest`.  
3. Service name: `incident-buddy-api`, region `europe-west2`.  
4. **Authentication:** Allow unauthenticated invocations (demo).  
5. **Container** → Port `8080`, memory **512 MiB**, CPU **1**, request timeout **300** s.  
6. **Autoscaling** → Min instances **1**, max **4** (keeps scheduler alive).  
7. **Variables** (plain env):

| Name | Value |
| ---- | ----- |
| `DATABASE_PATH` | `/tmp/incidentbuddy.db` |
| `RUNBOOKS_DIR` | `/app/runbooks` |
| `CORS_ORIGINS` | `*` |
| `DEMO_LOOP_ENABLED` | `true` |

8. **Secrets** → **Reference a secret** (create in Secret Manager first — [§1.2](#12-secret-manager-required-before-deploy)):

| Env var | Secret ID |
| ------- | --------- |
| `ADMIN_TOKEN` | `incidentbuddy-admin-token` |
| `DEMO_TOKEN` | `incidentbuddy-demo-token` |
| `TRUEFOUNDRY_GATEWAY_URL` | `incidentbuddy-truefoundry-gateway-url` |
| `TRUEFOUNDRY_API_KEY` | `incidentbuddy-truefoundry-api-key` |
| `OPENAI_API_KEY` | `incidentbuddy-openai-api-key` (optional) |

9. **Create** → copy the service URL.

#### E. Cloud Run — UI service

1. **Create service** → image `incident-buddy-frontend:latest`.  
2. Name: `incident-buddy-ui`, same region.  
3. Allow unauthenticated, port **8080**, min instances **1**, timeout **300** s.  
4. Environment variable `BACKEND_URL` = API URL from step D (no trailing slash).  
5. **Create** → this URL is your **judging URL**.

Never put secret **values** in `terraform.tfvars` — only secret **IDs**. The file is gitignored.

### 1.7 Judging URL and demo token

```
https://<frontend_url>?t=<DEMO_TOKEN>
```

- `DEMO_TOKEN` gates mutating routes (`simulate-alert`, `run-agent`, comms approve/reject, loop pause/resume).  
- Read-only routes stay public so the dashboard renders without the token.  
- Store the demo token in Secret Manager (`incidentbuddy-demo-token`); Terraform maps it to `DEMO_TOKEN`.

**Admin / chaos panel:** use the same value as `ADMIN_TOKEN` in the UI admin token field.


### 1.8 Costs (typical hackathon usage)

| Resource | Estimate |
| -------- | -------- |
| Cloud Run (min 1 × 2 services, 512 MiB) | Low tens of $/mo if left always on; much less if min = 0 between demos |
| Artifact Registry | Pennies for two images |
| Egress | Usually negligible for demo traffic |
| LLM | TrueFoundry/Crusoe/OpenAI — only when judges are active (`LOOP_LIVE_LLM_IDLE_MINUTES`) |

Use `min_instance_count = 0` in `terraform.tfvars` to save money; accept cold starts and possible SQLite reset.

### 1.12 Destroy GCP resources

```bash
make tf-destroy
# or: cd terraform && terraform destroy
```

Images remain in Artifact Registry until deleted manually.


## 2. Local development (two processes)

No Docker required.

### 2.1 Backend

```bash
cd incident-buddy
cp .env.example .env
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: <http://127.0.0.1:8000>  
- Swagger: <http://127.0.0.1:8000/docs>  
- Loop: <http://127.0.0.1:8000/api/admin/loop/status>

Set `DEMO_LOOP_ENABLED=false` in `.env` to disable the scheduler while editing.

### 2.2 Frontend

```bash
cd incident-buddy/frontend
npm install
export BACKEND_URL=http://127.0.0.1:8000
npm run dev
```

- UI: <http://localhost:3000>

`BACKEND_URL` enables same-origin `/api/*` rewrites (see `frontend/next.config.mjs`).

### 2.3 Auth gate in dev

Leave `DEMO_TOKEN` empty in `.env` to disable the mutating-route gate.


## 3. Local Docker stack

Full-stack integration test before GCP.

```bash
cd incident-buddy
cp .env.example .env
docker compose up --build
```

| Service | URL |
| ------- | --- |
| **UI** | <http://localhost:3000> |
| **API** | <http://localhost:8000> |
| **Swagger** | <http://localhost:8000/docs> |

```
Browser → localhost:3000 → ui → api:8080 → SQLite volume /data
```

- UI proxies `/api/*` to the internal API.  
- SSR uses `BACKEND_URL=http://api:8080` from `docker-compose.yml`.  
- SQLite persists in Docker volume `incidentbuddy-data`.

```bash
docker compose down      # stop, keep data
docker compose down -v   # delete SQLite volume
```

Manual image build:

```bash
docker build -f deploy/Dockerfile.backend -t incident-buddy-api:local .
docker build -f deploy/Dockerfile.frontend --build-arg BACKEND_URL=http://api:8080 -t incident-buddy-ui:local .
```


## 4. Environment variables (reference)

Copy [`.env.example`](../.env.example). For GCP production, store tokens and API keys only in **Secret Manager** (see [§1.2](#12-secret-manager-required-before-deploy)).

### Backend (Cloud Run)

| Variable | Cloud Run default | Notes |
| -------- | ----------------- | ----- |
| `DATABASE_PATH` | `/tmp/incidentbuddy.db` | Ephemeral on Cloud Run |
| `RUNBOOKS_DIR` | `/app/runbooks` | Baked in image |
| `CORS_ORIGINS` | `*` | Or restrict to UI URL |
| `ADMIN_TOKEN` | Secret Manager | Chaos + demo reset |
| `DEMO_TOKEN` | Secret Manager | Judging URL `?t=` |
| `DEMO_LOOP_ENABLED` | `true` | Background scheduler |
| `TRUEFOUNDRY_GATEWAY_URL` | Secret Manager | |
| `TRUEFOUNDRY_API_KEY` | Secret Manager | |
| `OPENAI_API_KEY` | Secret Manager | Optional; `mount_openai_api_key` in tfvars |
| `LOOP_*` | see `terraform/main.tf` | Loop cadence / GC / idle LLM |
| `SSE_KEEPALIVE_SECONDS` | `15` | Proxy heartbeat |

### Frontend (Cloud Run)

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `BACKEND_URL` | Yes | **Docker build-arg** + runtime env for SSR |
| `NEXT_PUBLIC_API_URL` | Dev only | Direct fetch without proxy |


## 5. Health checks

| Endpoint | Purpose |
| -------- | ------- |
| `GET /healthz` | Liveness |
| `GET /api/health` | Readiness |
| `GET /api/health/resilience` | Gateway + chaos |
| `GET /api/admin/loop/status` | Scheduler snapshot |

Configure Cloud Run health checks against `/healthz` on port 8080 if you add custom probes.


## 6. Topology comparison

| Aspect | Local dev | Docker Compose | **GCP Cloud Run** |
| ------ | --------- | -------------- | ----------------- |
| UI URL | :3000 | :3000 | `terraform output frontend_url` |
| API URL | :8000 | :8000 | `terraform output backend_url` |
| DB | `backend/data/*.db` | Docker volume | `/tmp` (ephemeral) |
| HTTPS | No | No | Yes |
| Background loop | Yes | Yes | Yes if min instances ≥ 1 |
| IaC | — | compose | `terraform/` |
| Cost | Free | Free | Pay-as-you-go / free tier credits |


## 7. Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| **Browser `/api/*` fails on Cloud Run** | Frontend image built without `BACKEND_URL` | Rebuild with `BACKEND_URL=<api-url>` → redeploy UI |
| **SSR works, client fetch fails** | Same as above | `gcp-push-images.sh --frontend-only` with correct URL |
| **Empty incidents after idle** | Scale-to-zero wiped `/tmp` SQLite | Set `min_instance_count = 1` or re-simulate |
| **Loop not running** | `DEMO_LOOP_ENABLED=false` or paused | `GET /api/admin/loop/status` |
| **Mutations 401** | Missing `?t=DEMO_TOKEN` | Check `incidentbuddy-demo-token` secret version |
| **Chaos panel 401** | Wrong admin token | Match Secret Manager `incidentbuddy-admin-token` in UI |
| **Container fails to start** | Secret missing or no accessor IAM | Create secret + version; re-run `terraform apply` for IAM |
| **LLM template-only** | Secret empty or wrong key | New Secret Manager version; redeploy API |
| **terraform apply: image not found** | Images not pushed | Run `gcp-push-images.sh` with correct `IMAGE_TAG` |
| **Permission denied on apply** | Missing IAM roles | Add Cloud Run Admin + Artifact Registry Writer |
| **Public 403 on URL** | IAM invoker missing | `allow_unauthenticated = true` or add `allUsers` as Run Invoker |
| **SSE drops** | Idle timeout | `SSE_KEEPALIVE_SECONDS=15`; Cloud Run timeout 300s |
| **Duplicate chaos ticks** | Multiple API instances | Keep `max_instance_count = 1` on API or min=1 max=1 |
| **Docker: empty incident list** | Wrong SSR `BACKEND_URL` | `BACKEND_URL=http://api:8080` on `ui` service |
| **`docker push` … `connection refused`** (Cloud Shell) | Local Docker → Artifact Registry network flake | Use **Cloud Build** push below; retry often works too |

### 7.1 Cloud Shell: `docker push` connection refused

If the image **builds** but **push** fails with `dial tcp …:443: connect: connection refused` to `*.pkg.dev`, the registry is fine — the Cloud Shell Docker daemon lost connectivity. Fix:

```bash
export GCP_PROJECT_ID=prj-caiml-hackathon-01
export GCP_REGION=europe-west2   # must match terraform.tfvars region

gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev -q

# Confirm the repo exists (create via terraform first if missing)
gcloud artifacts repositories describe incident-buddy --location="${GCP_REGION}"

# Preferred in Cloud Shell — build+push inside GCP (no local docker push):
chmod +x scripts/gcp-cloud-build-push.sh
./scripts/gcp-cloud-build-push.sh --backend-only
```

Or one-shot:

```bash
gcloud builds submit . --config=cloudbuild.backend.yaml \
  --substitutions=_REGION=${GCP_REGION},_TAG=latest
```

Ensure `GCP_REGION`, `terraform.tfvars` `region`, and the image URL in Terraform all use the **same** region (e.g. `europe-west2`).


## 8. Related files

| Path | Role |
| ---- | ---- |
| [`terraform/`](../terraform/) | Cloud Run + Artifact Registry + IAM |
| [`terraform/terraform.tfvars.example`](../terraform/terraform.tfvars.example) | Variable template |
| [`terraform/secrets.tf`](../terraform/secrets.tf) | Secret Manager IAM + Cloud Run mounts |
| [`scripts/gcp-create-secrets.sh`](../scripts/gcp-create-secrets.sh) | Interactive secret bootstrap |
| [`scripts/gcp-deploy.sh`](../scripts/gcp-deploy.sh) | Full two-phase GCP deploy |
| [`scripts/gcp-push-images.sh`](../scripts/gcp-push-images.sh) | Local Docker build/push to Artifact Registry |
| [`scripts/gcp-cloud-build-push.sh`](../scripts/gcp-cloud-build-push.sh) | Cloud Build push (Cloud Shell friendly) |
| [`cloudbuild.backend.yaml`](../cloudbuild.backend.yaml) | API image Cloud Build config |
| [`cloudbuild.frontend.yaml`](../cloudbuild.frontend.yaml) | UI image Cloud Build config |
| [`deploy/Dockerfile.backend`](../deploy/Dockerfile.backend) | API image |
| [`deploy/Dockerfile.frontend`](../deploy/Dockerfile.frontend) | UI image (`ARG BACKEND_URL`) |
| [`docker-compose.yml`](../docker-compose.yml) | Local stack |
| [`.env.example`](../.env.example) | Local env reference |