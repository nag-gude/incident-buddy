#!/usr/bin/env bash
# Push images via Cloud Build (recommended in Cloud Shell when `docker push` fails).
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
TAG="${IMAGE_TAG:-latest}"

BACKEND_ONLY=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only) BACKEND_ONLY=true; shift ;;
    --frontend-only) FRONTEND_ONLY=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

gcloud config set project "$PROJECT" >/dev/null

if ! $FRONTEND_ONLY; then
  echo "Cloud Build: backend → ${REGION}-docker.pkg.dev/${PROJECT}/incident-buddy/..."
  gcloud builds submit . --config=cloudbuild.backend.yaml \
    --substitutions="_REGION=${REGION},_TAG=${TAG}"
fi

if ! $BACKEND_ONLY; then
  if [[ -z "${BACKEND_URL:-}" ]]; then
    echo "ERROR: Set BACKEND_URL before --frontend-only" >&2
    exit 1
  fi
  echo "Cloud Build: frontend (BACKEND_URL=${BACKEND_URL}) ..."
  gcloud builds submit . --config=cloudbuild.frontend.yaml \
    --substitutions="_REGION=${REGION},_TAG=${TAG},_BACKEND_URL=${BACKEND_URL}"
fi

echo "Done."
