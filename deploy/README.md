# Deploy artifacts

| File | Purpose |
| ---- | ------- |
| `Dockerfile.backend` | FastAPI + runbooks + SQLite volume mount |
| `Dockerfile.frontend` | Next.js standalone (requires `output: 'standalone'` in `next.config.mjs`) |

Build from **repository root**:

```bash
docker build -f deploy/Dockerfile.backend -t incident-buddy-api:local .
docker build -f deploy/Dockerfile.frontend -t incident-buddy-ui:local .
```

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for Compose, GCP, and troubleshooting.
