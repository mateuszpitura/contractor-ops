# ─────────────────────────────────────────────────────────────────────────────
# Input variables. Fill actual values in terraform.tfvars (gitignored) or
# pass via `-var=...` / CI env vars (TF_VAR_*).
# ─────────────────────────────────────────────────────────────────────────────

variable "region" {
  description = "AWS region. Use `me-south-1` (Bahrain) unless customer contract mandates UAE specifically — me-south-1 has broader service parity and lower Aurora pricing."
  type        = string
  default     = "me-south-1"

  validation {
    condition     = contains(["me-south-1", "me-central-1"], var.region)
    error_message = "Only me-south-1 (Bahrain) and me-central-1 (UAE) are permitted for the ME stack — other regions would violate the data-residency guarantee this stack exists to provide."
  }
}

variable "environment" {
  description = "Deployment environment. Must match the tag used on all other envs for cost attribution."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be 'production' or 'staging'."
  }
}

variable "domain_name" {
  description = "Apex domain for the ME stack (e.g. `me.contractor-ops.com`). A Route53 hosted zone for this domain must already exist in the same AWS account — Terraform does NOT create the zone itself (domain ownership is out-of-band)."
  type        = string
}

variable "app_subdomain" {
  description = "Subdomain for the Next.js `web` app. Final URL: https://<app_subdomain>.<domain_name>"
  type        = string
  default     = "app"
}

variable "api_subdomain" {
  description = "Subdomain for the Enterprise `public-api`. Final URL: https://<api_subdomain>.<domain_name>"
  type        = string
  default     = "api"
}

# ── Container images ───────────────────────────────────────────────────────
# Images are built in CI (same Dockerfiles as Render) and pushed to both
# Render's registry and this ECR. See .github/workflows/ecr-mirror.yml.
variable "image_tag" {
  description = "Tag of the container image to deploy across all ECS services. Should match the commit SHA that was tested on Render EU — do NOT deploy a commit to ME before it has baked on EU."
  type        = string
}

variable "ecr_repo_web" {
  description = "ECR repo name for the `web` image."
  type        = string
  default     = "contractor-ops/web"
}

variable "ecr_repo_public_api" {
  description = "ECR repo name for the `public-api` image."
  type        = string
  default     = "contractor-ops/public-api"
}

variable "ecr_repo_worker" {
  description = "ECR repo name for the `worker` image (same Dockerfile as web, different CMD). If you share the web image and override CMD in the task definition, set this equal to ecr_repo_web."
  type        = string
  default     = "contractor-ops/web"
}

# ── Compute sizing ─────────────────────────────────────────────────────────
# Conservative defaults — tune after first week of ME traffic observation.
# Fargate charges by vCPU-second and GB-second, so under-provisioning and
# autoscaling beats over-provisioning.

variable "web_cpu" {
  description = "vCPU units for the `web` Fargate task (1024 = 1 vCPU)."
  type        = number
  default     = 1024
}

variable "web_memory" {
  description = "MB of memory for the `web` Fargate task. Must be a valid Fargate combination — see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html"
  type        = number
  default     = 2048
}

variable "web_desired_count" {
  description = "Desired task count for `web`. Autoscaling overrides this during runtime."
  type        = number
  default     = 2
}

variable "public_api_cpu" {
  description = "vCPU units for `public-api`. Enterprise traffic is typically lower volume than `web` but latency-sensitive."
  type        = number
  default     = 512
}

variable "public_api_memory" {
  description = "MB of memory for `public-api`."
  type        = number
  default     = 1024
}

variable "public_api_desired_count" {
  description = "Desired task count for `public-api`."
  type        = number
  default     = 2
}

variable "worker_cpu" {
  description = "vCPU units for the `worker` Fargate task. Single instance — node-cron is not multi-instance-safe."
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "MB of memory for the `worker` Fargate task."
  type        = number
  default     = 1024
}

# ── Database ───────────────────────────────────────────────────────────────

variable "db_name" {
  description = "Initial Postgres database name."
  type        = string
  default     = "contractor_ops_me"
}

variable "db_master_username" {
  description = "Master DB username. The password is auto-generated and stored in Secrets Manager (not set via this variable)."
  type        = string
  default     = "contractor_ops_admin"
}

variable "db_min_capacity" {
  description = "Aurora Serverless v2 min ACU (0.5 ACU = ~1GB RAM, smallest billable unit)."
  type        = number
  default     = 0.5
}

variable "db_max_capacity" {
  description = "Aurora Serverless v2 max ACU. Aurora scales in 0.5 ACU increments."
  type        = number
  default     = 4
}

variable "db_deletion_protection" {
  description = "Block accidental `terraform destroy` on the DB cluster. MUST be true in production."
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "Automated backup retention window. ME regulators typically require ≥30 days audit retention — confirm with compliance before lowering."
  type        = number
  default     = 30
}

# ── Observability ──────────────────────────────────────────────────────────

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention. Shorter = cheaper, but compliance audits often require 90+ days. Default 90d is a safe starting point."
  type        = number
  default     = 90
}

variable "sentry_dsn" {
  description = "Sentry DSN with ME region tag. Create a separate Sentry project or environment for ME so EU/ME events stay segregated."
  type        = string
  sensitive   = true
  default     = ""
}

# ── ElastiCache ────────────────────────────────────────────────────────────

variable "elasticache_node_type" {
  description = "ElastiCache node type for the Valkey replication group. t4g.small (2 vCPU, 1.37 GB, Graviton) is the cheapest production-viable option (~$25/mo per node × 2 nodes = ~$50/mo). Bump to m7g.large if the cache hit rate drops or memory alarm fires."
  type        = string
  default     = "cache.t4g.small"
}
