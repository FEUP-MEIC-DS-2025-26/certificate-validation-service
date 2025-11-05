variable "project_id" {
  description = "The Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "The region where resources will be deployed."
  type        = string
  default     = "europe-southwest1"
}

variable "service_name" {
  description = "The name for the Cloud Run service."
  type        = string
  default     = "hello-world-service"
}

variable "docker_image" {
  description = "Container image to deploy to Cloud Run (including tag)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

