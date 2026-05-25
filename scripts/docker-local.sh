#!/usr/bin/env bash
# Build and start IncidentBuddy via Docker Compose (repository root).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example ..."
  cp .env.example .env
fi

docker compose up --build "$@"
