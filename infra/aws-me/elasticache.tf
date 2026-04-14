# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache (Valkey) — in-region cache + rate limit store.
#
# Replaces Upstash Redis for ME-tenant traffic. Upstash has no ME region,
# so every rate-limit check from AWS me-south-1 makes a ~200ms HTTP roundtrip
# to the nearest Upstash POP (usually EU or Asia). At rate-limit middleware
# scale (every request) this latency alone breaks ME SLAs.
#
# Valkey 8 is the AWS-forked OSS successor to Redis 7.2 — wire-compatible,
# lower licensing risk, and what ElastiCache pushes as the default engine
# from 2024 onwards.
#
# IMPORTANT: the app currently uses @upstash/redis (HTTP REST). Using this
# ElastiCache cluster requires the ioredis migration tracked in TECH-DEBT §1.
# Until that lands, REDIS_URL is set but unused — the app keeps calling
# Upstash. The resource is provisioned now so that the migration is a
# config + code change, not an infrastructure change on top.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "cache" {
  name       = "${local.name_prefix}-cache"
  subnet_ids = module.vpc.private_subnets
  description = "Subnet group for the ElastiCache replication group."
}

resource "aws_security_group" "cache" {
  name        = "${local.name_prefix}-cache"
  description = "ElastiCache — Valkey on 6379, ingress from ECS tasks only."
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "Valkey from ECS tasks."
  }
}

# ── AUTH token ────────────────────────────────────────────────────────────
# Valkey does not need an AUTH token in-VPC (SG restricts ingress), but
# ElastiCache requires one when at-rest encryption + in-transit TLS is on.
# Generate a long random token; store in Secrets Manager for the app to read.
resource "random_password" "cache_auth" {
  length           = 64
  special          = false  # ElastiCache AUTH rejects most special chars
}

resource "aws_secretsmanager_secret" "cache_url" {
  name                    = "${local.name_prefix}-redis-url"
  description             = "Valkey connection URL (rediss://... with TLS + AUTH). Consumed by app tasks once @upstash/redis → ioredis migration completes."
  recovery_window_in_days = 30
}

# ── Replication group (primary + replica for HA) ─────────────────────────

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "${local.name_prefix}-cache"
  description          = "Valkey cache + rate-limit store for the ME stack."

  engine                     = "valkey"
  engine_version             = "8.0"
  node_type                  = var.elasticache_node_type
  num_cache_clusters         = 2  # primary + 1 replica across AZs
  automatic_failover_enabled = true
  multi_az_enabled           = true

  port                 = 6379
  parameter_group_name = "default.valkey8"

  subnet_group_name  = aws_elasticache_subnet_group.cache.name
  security_group_ids = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.cache_auth.result

  # Automatic backups — 7-day retention covers typical ransomware / operator
  # mistake recovery without paying for indefinite snapshots.
  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"
  maintenance_window       = "sun:04:00-sun:05:00"

  apply_immediately = false
  auto_minor_version_upgrade = true

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.elasticache_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.elasticache_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }
}

resource "aws_cloudwatch_log_group" "elasticache_slow" {
  name              = "/elasticache/${local.name_prefix}/slow"
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_cloudwatch_log_group" "elasticache_engine" {
  name              = "/elasticache/${local.name_prefix}/engine"
  retention_in_days = var.cloudwatch_log_retention_days
}

# Write the final URL to Secrets Manager. Operators will push this to the
# REDIS_URL key in app_secrets after the cluster is healthy (one-off, not
# Terraform-managed to avoid password-in-state concerns).
resource "aws_secretsmanager_secret_version" "cache_url" {
  secret_id = aws_secretsmanager_secret.cache_url.id
  secret_string = format(
    "rediss://:%s@%s:6379",
    random_password.cache_auth.result,
    aws_elasticache_replication_group.cache.primary_endpoint_address,
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Alarm: cache memory pressure ──────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cache_memory" {
  alarm_name          = "${local.name_prefix}-cache-memory-high"
  alarm_description   = "Valkey database memory usage > 80%. Risk of eviction causing cache misses / rate-limit leaks. Scale node_type up."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.cache.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
