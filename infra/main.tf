terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "made-in-portugal-terraform-state"
    prefix = "certificate-validation"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Cloud Storage bucket for certificates
resource "google_storage_bucket" "certificates" {
  name          = var.bucket_name
  location      = var.bucket_location
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = true
  }
}

# Firestore database
resource "google_firestore_database" "certificates_db" {
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
}

# Service Account for the application
resource "google_service_account" "certificate_validation" {
  account_id   = var.service_account_id
  display_name = "Certificate Validation Service"
}

# IAM permissions for the service account
resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.certificate_validation.email}"
}

resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.certificate_validation.email}"
}

resource "google_storage_bucket_iam_member" "certificates_admin" {
  bucket = google_storage_bucket.certificates.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.certificate_validation.email}"
}

# Output values for use in Cloud Run
output "bucket_name" {
  value = google_storage_bucket.certificates.name
}

output "service_account_email" {
  value = google_service_account.certificate_validation.email
}