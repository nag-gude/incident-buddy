#!/usr/bin/env bash
# Build and push IncidentBuddy images to GCP Artifact Registry.
#
# Usage (from repository root):
#   export GCP_PROJECT_ID=your-project
#   ./scripts/gcp-push-images.sh                    # both images
#   ./scripts/gcp-push-images.sh --backend-only     # API only (first deploy)
#   BACKEND_URL=https://api-xxx.run.app ./scripts/gcp-push-images.sh --frontend-only
#
set -euo pipefail

PROJECT="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
REPO="${ARTIFACT_REPO:-incident-buddy}"
TAG="${IMAGE_TAG:-latest}"
PREFIX="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"

BACKEND_ONLY=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only) BACKEND_ONLY=true; shift ;;
    --frontend-only) FRONTEND_ONLY=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if $BACKEND_ONLY && $FRONTEND_ONLY; then
  echo "Use only one of --backend-only or --frontend-only" >&2
  exit 1
fi

echo "Configuring docker auth for ${REGION}-docker.pkg.dev ..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" -q

build_backend() {
  echo "Building backend ..."
  docker build -f deploy/Dockerfile.backend -t "${PREFIX}/incident-buddy-backend:${TAG}" .
  docker push "${PREFIX}/incident-buddy-backend:${TAG}"
}

build_frontend() {
  if [[ -z "${BACKEND_URL:-}" ]]; then
    echo "ERROR: Set BACKEND_URL to the public API URL before building the frontend image." >&2
    echo "  Example: BACKEND_URL=\$(cd terraform && terraform output -raw backend_url) \\" >&2
    echo "           ./scripts/gcp-push-images.sh --frontend-only" >&2
    exit 1
  fi
  echo "Building frontend (BACKEND_URL=${BACKEND_URL}) ..."
  docker build -f deploy/Dockerfile.frontend \
    --build-arg "BACKEND_URL=${BACKEND_URL}" \
    -t "${PREFIX}/incident-buddy-frontend:${TAG}" .
  docker push "${PREFIX}/incident-buddy-frontend:${TAG}"
}

if ! $FRONTEND_ONLY; then
  build_backend
fi

if ! $BACKEND_ONLY; then
  build_frontend
fi

echo "Done. Images at ${PREFIX}/"
