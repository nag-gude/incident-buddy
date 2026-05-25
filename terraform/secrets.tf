data "google_project" "current" {
  project_id = var.project_id
}

locals {
  cloud_run_runtime_sa = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  # Env vars injected from Secret Manager (create secrets before apply — see docs/DEPLOYMENT.md).
  backend_secret_env = concat(
    [
      { name = "ADMIN_TOKEN", secret = var.secret_admin_token },
      { name = "DEMO_TOKEN", secret = var.secret_demo_token },
      { name = "TRUEFOUNDRY_API_KEY", secret = var.secret_truefoundry_api_key },
      { name = "TRUEFOUNDRY_GATEWAY_URL", secret = var.secret_truefoundry_gateway_url },
    ],
    var.mount_openai_api_key ? [{ name = "OPENAI_API_KEY", secret = var.secret_openai_api_key }] : [],
  )

  secret_iam_ids = distinct(concat(
    [var.secret_admin_token, var.secret_demo_token, var.secret_truefoundry_api_key, var.secret_truefoundry_gateway_url],
    var.mount_openai_api_key ? [var.secret_openai_api_key] : [],
  ))
}

resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_secret_manager_secret_iam_member" "cloud_run_accessor" {
  for_each = toset(local.secret_iam_ids)

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = local.cloud_run_runtime_sa

  depends_on = [google_project_service.secretmanager]
}
