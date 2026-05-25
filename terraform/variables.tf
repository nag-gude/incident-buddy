variable "project_id" {
  type        = string
  description = "GCP project ID."
}

variable "region" {
  type        = string
  description = "Region for Artifact Registry and Cloud Run."
  default     = "europe-west2"
}

variable "artifact_repository_id" {
  type        = string
  description = "Artifact Registry repository id."
  default     = "incident-buddy"
}

variable "image_tag" {
  type        = string
  description = "Docker image tag for both services."
  default     = "latest"
}

variable "backend_service_name" {
  type    = string
  default = "incident-buddy-api"
}

variable "frontend_service_name" {
  type    = string
  default = "incident-buddy-ui"
}

variable "backend_image_name" {
  type    = string
  default = "incident-buddy-backend"
}

variable "frontend_image_name" {
  type    = string
  default = "incident-buddy-frontend"
}

variable "allow_unauthenticated" {
  type        = bool
  description = "Grant roles/run.invoker to allUsers (public hackathon demo)."
  default     = true
}

variable "min_instance_count" {
  type        = number
  description = "Minimum Cloud Run instances (1 keeps APScheduler + SSE warm; 0 saves cost but cold-starts)."
  default     = 1
}

variable "max_instance_count" {
  type    = number
  default = 4
}

# Secret Manager secret IDs (short names). Create secrets + versions in GCP before terraform apply.
variable "secret_admin_token" {
  type        = string
  description = "Secret Manager id for ADMIN_TOKEN."
  default     = "incidentbuddy-admin-token"
}

variable "secret_demo_token" {
  type        = string
  description = "Secret Manager id for DEMO_TOKEN (judging URL ?t=)."
  default     = "incidentbuddy-demo-token"
}

variable "secret_truefoundry_api_key" {
  type        = string
  description = "Secret Manager id for TRUEFOUNDRY_API_KEY."
  default     = "incidentbuddy-truefoundry-api-key"
}

variable "secret_truefoundry_gateway_url" {
  type        = string
  description = "Secret Manager id for TRUEFOUNDRY_GATEWAY_URL."
  default     = "incidentbuddy-truefoundry-gateway-url"
}

variable "secret_openai_api_key" {
  type        = string
  description = "Secret Manager id for OPENAI_API_KEY (optional fallback LLM)."
  default     = "incidentbuddy-openai-api-key"
}

variable "mount_openai_api_key" {
  type        = bool
  description = "Mount OPENAI_API_KEY from Secret Manager (set false if secret not created)."
  default     = false
}
