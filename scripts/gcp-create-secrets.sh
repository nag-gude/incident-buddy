#!/usr/bin/env bash
# Create IncidentBuddy secrets in GCP Secret Manager (interactive).
# Usage:
#   export GCP_PROJECT_ID=your-project
#   ./scripts/gcp-create-secrets.sh
#
# Re-run is safe: existing secrets are skipped; new versions are added when you enter a value.
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
gcloud config set project "$PROJECT" >/dev/null

create_or_version() {
  local id="$1"
  local prompt="$2"
  local required="${3:-true}"

  if ! gcloud secrets describe "$id" --project="$PROJECT" &>/dev/null; then
    echo "Creating secret: $id"
    gcloud secrets create "$id" --replication-policy=automatic --project="$PROJECT"
  else
    echo "Secret exists: $id"
  fi

  if [[ "$required" == "false" ]]; then
    read -r -p "$prompt (Enter to skip): " value
    [[ -z "$value" ]] && return 0
  else
    read -r -s -p "$prompt: " value
    echo
    [[ -z "$value" ]] && { echo "Value required for $id" >&2; exit 1; }
  fi

  printf '%s' "$value" | gcloud secrets versions add "$id" --data-file=- --project="$PROJECT"
  echo "  → version added for $id"
}

echo "Project: $PROJECT"
echo "Generate tokens with: openssl rand -hex 16"
echo ""

create_or_version "incidentbuddy-admin-token" "ADMIN_TOKEN (chaos panel)"
create_or_version "incidentbuddy-demo-token" "DEMO_TOKEN (judging URL ?t=)"
create_or_version "incidentbuddy-truefoundry-gateway-url" "TRUEFOUNDRY_GATEWAY_URL"
create_or_version "incidentbuddy-truefoundry-api-key" "TRUEFOUNDRY_API_KEY"
create_or_version "incidentbuddy-openai-api-key" "OPENAI_API_KEY (optional)" false

echo ""
echo "Done. Set mount_openai_api_key = true in terraform.tfvars if you created the OpenAI secret."
echo "Then: make gcp-deploy"
