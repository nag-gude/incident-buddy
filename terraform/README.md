# GCP Terraform — IncidentBuddy

Deploys Artifact Registry, two Cloud Run services, public IAM, and **Secret Manager** mounts for tokens/API keys.

## Prerequisites

1. `export GCP_PROJECT_ID="your-gcp-project-id"`
2. Create secrets: `../scripts/gcp-create-secrets.sh`
3. `cp terraform.tfvars.example terraform.tfvars` — set `project_id` only (no secret values)

## Deploy

```bash
cd ..
make gcp-deploy
```

## Secret IDs (defaults)

| Secret | Env var |
| ------ | ------- |
| `incidentbuddy-admin-token` | `ADMIN_TOKEN` |
| `incidentbuddy-demo-token` | `DEMO_TOKEN` |
| `incidentbuddy-truefoundry-gateway-url` | `TRUEFOUNDRY_GATEWAY_URL` |
| `incidentbuddy-truefoundry-api-key` | `TRUEFOUNDRY_API_KEY` |
| `incidentbuddy-openai-api-key` | `OPENAI_API_KEY` (optional) |

Override IDs in `terraform.tfvars`. Set `mount_openai_api_key = true` when the OpenAI secret exists.

Full guide: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
