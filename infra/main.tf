# Enable required APIs
resource "google_project_service" "firestore" {
  project = var.project_id
  service = "firestore.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  project = var.project_id
  service = "storage.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "run" {
  project = var.project_id
  service = "run.googleapis.com"

  disable_on_destroy = false
}

# Cloud Storage bucket for PDF certificates
resource "google_storage_bucket" "certificates" {
  name          = var.bucket_name
  location      = var.bucket_location
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.storage]
}

# Firestore database for certificate metadata
resource "google_firestore_database" "certificates_db" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}

# Service Account for the application
resource "google_service_account" "certificate_validation" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = "Certificate Validation Service"
  description  = "Service account for certificate validation application"
}

# IAM: Storage Object Admin on the bucket
resource "google_storage_bucket_iam_member" "certificates_admin" {
  bucket = google_storage_bucket.certificates.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.certificate_validation.email}"
}

# IAM: Firestore User for the service account
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.certificate_validation.email}"
}

# IAM: Allow Cloud Run to use the service account
resource "google_project_iam_member" "service_account_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.certificate_validation.email}"
}

# Outputs
output "bucket_name" {
  description = "The name of the Cloud Storage bucket for certificates"
  value       = google_storage_bucket.certificates.name
}

output "service_account_email" {
  description = "The email of the service account"
  value       = google_service_account.certificate_validation.email
}

output "firestore_database" {
  description = "The Firestore database name"
  value       = google_firestore_database.certificates_db.name
}
