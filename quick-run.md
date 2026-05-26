```bash
export GCP_PROJECT_ID=prj-caiml-hackathon-01
export GCP_REGION=europe-west2

# Same region everywhere (must match terraform.tfvars `region`)
gcloud config set project "$GCP_PROJECT_ID"
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev -q

# Repo must exist (terraform apply -target=google_artifact_registry_repository.incident_buddy)
gcloud artifacts repositories describe incident-buddy --location="${GCP_REGION}"
```

```bash

gcloud builds submit . --config=cloudbuild.backend.yaml \
  --substitutions=_REGION=${GCP_REGION},_TAG=latest


cd terraform && terraform apply -target=google_cloud_run_v2_service.backend -target=google_cloud_run_v2_service_iam_member.backend_public --auto-approve

export BACKEND_URL="$(terraform output -raw backend_url)"
echo "BACKEND_URL=$BACKEND_URL"

cd ..

gcloud builds submit . --config=cloudbuild.frontend.yaml \
  --substitutions=_REGION=${GCP_REGION},_TAG=latest,_BACKEND_URL=${BACKEND_URL}

cd terraform && terraform apply --auto-approve

```

**Incidents / Admin issues:** rebuild frontend with `_BACKEND_URL` set to the live API URL. Pause 429? Call API directly:

```bash
curl -X POST -H "X-Demo-Token: YOUR_TOKEN" "$(cd terraform && terraform output -raw backend_url)/api/admin/loop/pause"
```