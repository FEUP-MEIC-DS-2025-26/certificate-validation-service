data "google_project" "current" {
  project_id = var.project_id
}

# Pub/Sub Topics
resource "google_pubsub_topic" "certificate_validation" {
  name = "certificate-validation"
}

resource "google_pubsub_topic" "certificate_validator_response" {
  name = "certificate-validator-response"
}

# Pub/Sub Subscriptions
resource "google_pubsub_subscription" "certificate_validation_sub" {
  name  = "certificate-validation-sub"
  topic = google_pubsub_topic.certificate_validation.name

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days
}

resource "google_pubsub_subscription" "certificate_validator_response_sub" {
  name  = "certificate-validator-response-sub"
  topic = google_pubsub_topic.certificate_validator_response.name

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s" # 7 days
}

# Service Account for the application
resource "google_service_account" "certificate_validation_sa" {
  account_id   = var.service_account_id
  display_name = "Certificate Validation Service Account"
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "default" {
  name     = var.service_name
  location = var.region

  template {
    # 2. ATTACH THE CUSTOM SERVICE ACCOUNT HERE
    # Without this, it defaults to the insecure Compute Engine default account
    service_account = google_service_account.certificate_validation_sa.email

    containers {
      image = var.docker_image

      env {
        name  = "REQUEST_TOPIC"
        value = "projects/${var.project_id}/topics/${google_pubsub_topic.certificate_validation.name}"
      }
      env {
        name  = "RESPONSE_TOPIC"
        value = "projects/${var.project_id}/topics/${google_pubsub_topic.certificate_validator_response.name}"
      }
      env {
        name  = "RESPONSE_SUBSCRIPTION"
        value = "projects/${var.project_id}/subscriptions/${google_pubsub_subscription.certificate_validator_response_sub.name}"
      }
    }
  }
}

# Allow public access to the Cloud Run URL
resource "google_cloud_run_v2_service_iam_binding" "public_access" {
  project  = google_cloud_run_v2_service.default.project
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name

  role    = "roles/run.invoker"
  members = ["allUsers"]
}

# Grant permissions to the Service Account (on the Project level)
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.certificate_validation_sa.email}"
}

resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.certificate_validation_sa.email}"
}

resource "google_project_iam_member" "storage_object_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.certificate_validation_sa.email}"
}

resource "google_project_iam_member" "firestore_admin" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.certificate_validation_sa.email}"
}

# Outputs
output "service_url" {
  value = google_cloud_run_v2_service.default.uri
}

output "service_account_email" {
  value = google_service_account.certificate_validation_sa.email
}

output "request_subscription" {
  description = "The request Pub/Sub subscription name."
  value       = google_pubsub_subscription.certificate_validation_sub.name
}

output "response_subscription" {
  description = "The response Pub/Sub subscription name."
  value       = google_pubsub_subscription.certificate_validator_response_sub.name
}
