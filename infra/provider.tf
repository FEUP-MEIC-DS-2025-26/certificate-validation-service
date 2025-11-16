terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Store Terraform state remotely in a GCS bucket so CI and local runs
  # share the same state. Make sure this bucket exists before running
  # `terraform init` (for example, create it once via the console or gcloud).
  backend "gcs" {
    bucket = "made-in-portugal-terraform-state"
    prefix = "certificate-validation-service/infra"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
