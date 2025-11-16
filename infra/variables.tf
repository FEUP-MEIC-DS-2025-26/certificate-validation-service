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

variable "bucket_name" {
  description = "The name of the Cloud Storage bucket for certificates."
  type        = string
}

variable "bucket_location" {
  description = "The location for the Cloud Storage bucket."
  type        = string
  default     = "EUROPE-WEST1"
}

variable "firestore_location" {
  description = "The location for the Firestore database."
  type        = string
  default     = "europe-west1"
}

variable "service_account_id" {
  description = "The ID for the service account used by the application."
  type        = string
  default     = "certificate-validation-sa"
}

variable "docker_image" {
  description = "Container image to deploy to Cloud Run (including tag)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

