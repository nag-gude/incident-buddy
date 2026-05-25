#!/usr/bin/env bash
# End-to-end GCP deploy: registry → backend → frontend (two-phase image build).
# Usage (from repository root):
#   export GCP_PROJECT_ID=your-project-id
#   ./scripts/gcp-deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"

if [[ ! -f terraform/terraform.tfvars ]]; then
  echo "Copy terraform/terraform.tfvars.example → terraform/terraform.tfvars and edit project_id." >&2
  exit 1
fi

if ! gcloud secrets describe incidentbuddy-admin-token --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Create Secret Manager secrets first: ./scripts/gcp-create-secrets.sh" >&2
  exit 1
fi

echo "==> terraform init"
(cd terraform && terraform init -input=false)

echo "==> Enable APIs + Artifact Registry"
(cd terraform && terraform apply -target=google_project_service.apis -target=google_artifact_registry_repository.incident_buddy -auto-approve)

echo "==> Build & push backend image"
chmod +x scripts/gcp-push-images.sh
./scripts/gcp-push-images.sh --backend-only

echo "==> Deploy API to Cloud Run"
(cd terraform && terraform apply -target=google_cloud_run_v2_service.backend \
  -target=google_cloud_run_v2_service_iam_member.backend_public -auto-approve)

BACKEND_URL="$(cd terraform && terraform output -raw backend_url)"
echo "Backend URL: ${BACKEND_URL}"

echo "==> Build & push frontend image (rewrites target API)"
export BACKEND_URL
./scripts/gcp-push-images.sh --frontend-only

echo "==> Deploy UI + finalize"
(cd terraform && terraform apply -auto-approve)

echo ""
echo "Judging URL (add ?t=<DEMO_TOKEN> if demo_token is set in terraform.tfvars):"
(cd terraform && terraform output -raw frontend_url)
echo ""
echo "API docs:"
(cd terraform && terraform output -raw backend_url)
echo "/docs"
