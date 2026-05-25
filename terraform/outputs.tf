output "artifact_registry_url" {
  value       = google_artifact_registry_repository.incident_buddy.name
  description = "Artifact Registry resource name"
}

output "backend_url" {
  value       = google_cloud_run_v2_service.backend.uri
  description = "Public URL of the FastAPI backend (Swagger at /docs)."
}

output "frontend_url" {
  value       = google_cloud_run_v2_service.frontend.uri
  description = "Public URL of the Next.js UI (use for Devpost submission)."
}

output "docker_push_prefix" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repository_id}"
  description = "Docker tag prefix for image push commands"
}
