.PHONY: help up down logs build push-gcp push-gcp-cb gcp-create-secrets gcp-deploy tf-init tf-apply tf-destroy clean clean-all demo-video package-backend package-frontend package-source

help:
	@echo "IncidentBuddy deployment targets:"
	@echo "  make up               - Docker Compose up --build (UI :3000, API :8000)"
	@echo "  make down             - Stop Compose stack"
	@echo "  make logs             - Follow Compose logs"
	@echo "  make build            - Build Docker images locally (tags: local)"
	@echo "  make clean            - Remove build caches, temp captures, pytest cache"
	@echo "  make clean-all        - clean + node_modules + backend/.venv"
	@echo "  make package-backend  - Zip backend source (~44K) for Devpost upload"
	@echo "  make package-frontend - Zip frontend source (~250K) for Devpost upload"
	@echo "  make package-source   - Both zips (backend + frontend)"
	@echo "  make demo-video       - Record Devpost demo to assets/demo-video/"
	@echo "  make gcp-deploy  - Full GCP deploy; run gcp-create-secrets.sh first"
	@echo "  make push-gcp    - Local Docker build + push (use push-gcp-cb in Cloud Shell)"
	@echo "  make push-gcp-cb - Cloud Build push (fixes docker push connection refused)"
	@echo "  make tf-init     - terraform init"
	@echo "  make tf-apply    - terraform apply (after images pushed)"
	@echo "  make tf-destroy  - terraform destroy"

up:
	@test -f .env || cp .env.example .env
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker build -f deploy/Dockerfile.backend -t incident-buddy-api:local .
	docker build -f deploy/Dockerfile.frontend -t incident-buddy-ui:local .

gcp-create-secrets:
	@test -n "$$GCP_PROJECT_ID" || (echo "Set GCP_PROJECT_ID" && exit 1)
	chmod +x scripts/gcp-create-secrets.sh
	./scripts/gcp-create-secrets.sh

gcp-deploy:
	@test -n "$$GCP_PROJECT_ID" || (echo "Set GCP_PROJECT_ID" && exit 1)
	chmod +x scripts/gcp-deploy.sh scripts/gcp-push-images.sh
	./scripts/gcp-deploy.sh

push-gcp:
	@test -n "$$GCP_PROJECT_ID" || (echo "Set GCP_PROJECT_ID" && exit 1)
	chmod +x scripts/gcp-push-images.sh
	@if [ -n "$$BACKEND_URL" ]; then ./scripts/gcp-push-images.sh; else ./scripts/gcp-push-images.sh --backend-only; fi

push-gcp-cb:
	@test -n "$$GCP_PROJECT_ID" || (echo "Set GCP_PROJECT_ID" && exit 1)
	chmod +x scripts/gcp-cloud-build-push.sh
	@if [ -n "$$BACKEND_URL" ]; then ./scripts/gcp-cloud-build-push.sh; else ./scripts/gcp-cloud-build-push.sh --backend-only; fi

tf-init:
	cd terraform && terraform init

tf-apply:
	chmod +x scripts/terraform-apply.sh
	./scripts/terraform-apply.sh

tf-destroy:
	cd terraform && terraform destroy

clean:
	rm -rf frontend/.next frontend/out frontend/*.tsbuildinfo
	rm -rf backend/.pytest_cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find frontend -name .DS_Store -delete 2>/dev/null || true
	@echo "Cleaned build artifacts and temp folders."

clean-all: clean
	rm -rf frontend/node_modules backend/.venv
	@echo "Removed frontend/node_modules and backend/.venv"
	@echo "Restore: cd frontend && npm install && cd ../backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"

package-backend:
	chmod +x scripts/package-backend.sh
	./scripts/package-backend.sh

package-frontend:
	chmod +x scripts/package-frontend.sh
	./scripts/package-frontend.sh

package-source: package-backend package-frontend
	@echo "Upload incident-buddy-backend.zip and incident-buddy-frontend.zip, or push via git."
