terraform {
  required_version = ">= 1.5.0"
  backend "s3" {}
}
module "cdn" { source = "./modules/cdn" }
module "storage" { source = "./modules/storage" }
module "monitoring" { source = "./modules/monitoring" }
module "dns" { source = "./modules/dns" }
