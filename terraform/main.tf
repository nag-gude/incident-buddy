locals {
  ar_host        = "${var.region}-docker.pkg.dev"
  ar_repo        = "${local.ar_host}/${var.project_id}/${var.artifact_repository_id}"
  backend_image  = "${local.ar_repo}/${var.backend_image_name}:${var.image_tag}"
  frontend_image = "${local.ar_repo}/${var.frontend_image_name}:${var.image_tag}"

  backend_env = [
    { name = "CORS_ORIGINS", value = "*" },
    { name = "DATABASE_PATH", value = "/tmp/incidentbuddy.db" },
    { name = "RUNBOOKS_DIR", value = "/app/runbooks" },
    { name = "DEMO_LOOP_ENABLED", value = "true" },
    { name = "LOOP_INTERVAL_SECONDS", value = "60" },
    { name = "LOOP_STATE_STEP_SECONDS", value = "15" },
    { name = "LOOP_GC_MAX_INCIDENTS", value = "50" },
    { name = "LOOP_LIVE_LLM_IDLE_MINUTES", value = "15" },
    { name = "LOOP_MAX_CONCURRENT_INCIDENTS", value = "2" },
    { name = "SSE_KEEPALIVE_SECONDS", value = "15" },
    { name = "PRIMARY_LLM_MODEL", value = "nvidia/nemotron" },
    { name = "PRIMARY_LLM_PROVIDER", value = "crusoe-nemotron" },
  ]
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "incident_buddy" {
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "IncidentBuddy containers"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    max_instance_request_concurrency = 16
    timeout                          = "300s"

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = local.backend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      dynamic "env" {
        for_each = local.backend_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name = "LAST_DEPLOYED_AT"
        value = timestamp()
      }

      dynamic "env" {
        for_each = local.backend_secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = "projects/${var.project_id}/secrets/${env.value.secret}"
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.incident_buddy,
    google_secret_manager_secret_iam_member.cloud_run_accessor,
  ]
}

resource "google_cloud_run_v2_service" "frontend" {
  name     = var.frontend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    max_instance_request_concurrency = 32
    timeout                          = "300s"

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = local.frontend_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "BACKEND_URL"
        value = google_cloud_run_v2_service.backend.uri
      }

      env {
        name = "LAST_DEPLOYED_AT"
        value = timestamp()
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_cloud_run_v2_service.backend]
}

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
