# Google Cloud deployment — sovereign-game-universe
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
}
variable "project_id" { type = string }
variable "region" { type = string, default = "us-central1" }
# GKE cluster, Cloud SQL, Cloud Storage, Cloud CDN, Cloud Armor (WAF), Cloud Run
resource "google_container_cluster" "primary" {
  name     = "sgu-cluster"
  location = var.region
  initial_node_count = 3
}
resource "google_sql_database_instance" "postgres" {
  name             = "sgu-postgres"
  database_version = "POSTGRES_16"
  region           = var.region
  settings { tier = "db-custom-2-7680" }
}
resource "google_storage_bucket" "game-assets" {
  name     = "sgu-game-assets"
  location = var.region
  uniform_bucket_level_access = true
}
