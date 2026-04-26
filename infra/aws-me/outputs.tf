# ─────────────────────────────────────────────────────────────────────────────
# Outputs — values operators need after `terraform apply` to configure the
# app, populate the shared Render env group for cross-region routing, or
# open the AWS console at the right resource.
# ─────────────────────────────────────────────────────────────────────────────

output "region" {
  description = "AWS region this stack runs in."
  value       = var.region
}

output "alb_dns_name" {
  description = "Raw ALB hostname. Traffic reaches the app via Route53 alias records, but this is useful for direct health-checking."
  value       = aws_lb.this.dns_name
}

output "web_url" {
  description = "Public HTTPS URL of the Next.js `web` app."
  value       = "https://${var.app_subdomain}.${var.domain_name}"
}

output "public_api_url" {
  description = "Public HTTPS URL of the Enterprise REST API."
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "aurora_cluster_endpoint" {
  description = "Aurora writer endpoint. Consumers should prefer the DATABASE_URL secret; this is exposed for DBA access only."
  value       = module.aurora.cluster_endpoint
  sensitive   = true
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN for DATABASE_URL. Reference this when wiring cross-region DB access from the EU stack if ME-tenant rows need to be visible during a migration window."
  value       = aws_secretsmanager_secret.database_url.arn
}

output "app_secrets_arn" {
  description = "Secrets Manager ARN for the JSON blob of application secrets. Operators edit this via `aws secretsmanager update-secret` after the first apply."
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "documents_bucket" {
  description = "S3 bucket name for ME-tenant document storage. Maps to R2_BUCKET_NAME_ME in app env."
  value       = aws_s3_bucket.documents.id
}

output "ecr_repositories" {
  description = "ECR repo URLs — push images here from CI before each deploy."
  value = {
    for k, v in aws_ecr_repository.this : k => v.repository_url
  }
}

output "cluster_name" {
  description = "ECS cluster name. Use with `aws ecs update-service --cluster <this> --service <svc> --force-new-deployment` to roll a new image."
  value       = aws_ecs_cluster.this.name
}

output "alerts_topic_arn" {
  description = "SNS topic ARN for alarms. Subscribe PagerDuty / Opsgenie manually to this topic."
  value       = aws_sns_topic.alerts.arn
}
