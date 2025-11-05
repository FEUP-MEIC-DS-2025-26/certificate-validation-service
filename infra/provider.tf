terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Terraform state stored in Google Cloud Storage
  backend "gcs" {
    bucket = "made-in-portugal-terraform-state"
    prefix = "certificate-validation"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
