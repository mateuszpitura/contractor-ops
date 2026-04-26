# ─────────────────────────────────────────────────────────────────────────────
# RDS Proxy — connection pooling + failover awareness in front of Aurora.
#
# Without a proxy, each Fargate task opens its own Prisma connection pool.
# At autoscaled peak (8 web + 6 public-api + 1 worker + N crons) with
# ~10 connections each, we'd burn ~150 connections on Aurora Serverless v2
# at 0.5 ACU (which has a hard limit of 2000, but long before that we hit
# CPU pressure from connection churn on every scale event).
#
# RDS Proxy multiplexes: tasks open pooled connections to the proxy, proxy
# holds a smaller pool of backend connections to Aurora. Bonus: failover
# handoff is ~1s instead of the 30–60s a Prisma client takes to re-resolve.
#
# Cost: ~$0.015/ACU-hour × 2 (min) = ~$22/mo baseline. Pays for itself at
# modest scale and is insurance against connection storms at high scale.
#
# App-side: switch DATABASE_URL from the cluster endpoint to the proxy
# endpoint (see output below). Prisma's connection_limit can be LOWERED
# per task since the proxy handles multiplexing.
# ─────────────────────────────────────────────────────────────────────────────

# Secret in the format RDS Proxy expects: {"username": "...", "password": "..."}
# — already how aws_secretsmanager_secret.db_master stores it. Proxy attaches
# directly via secret ARN.

resource "aws_iam_role" "rds_proxy" {
  name = "${local.name_prefix}-rds-proxy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name = "${local.name_prefix}-rds-proxy-secrets"
  role = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.db_master.arn]
    }]
  })
}

resource "aws_security_group" "rds_proxy" {
  name        = "${local.name_prefix}-rds-proxy"
  description = "RDS Proxy — accepts 5432 from ECS tasks, egresses to Aurora SG."
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "Postgres from Fargate tasks."
  }

  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds.id]
    description     = "Outbound to Aurora cluster."
  }
}

# Allow RDS Proxy to reach Aurora.
resource "aws_security_group_rule" "rds_from_proxy" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds_proxy.id
  security_group_id        = aws_security_group.rds.id
  description              = "Postgres from the RDS Proxy."
}

resource "aws_db_proxy" "aurora" {
  name                   = "${local.name_prefix}-aurora-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = module.vpc.private_subnets
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  require_tls            = true
  idle_client_timeout    = 1800  # 30 min — long enough for Prisma's default pool

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_master.arn
  }
}

resource "aws_db_proxy_default_target_group" "aurora" {
  db_proxy_name = aws_db_proxy.aurora.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 95
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "aurora" {
  db_proxy_name         = aws_db_proxy.aurora.name
  target_group_name     = aws_db_proxy_default_target_group.aurora.name
  db_cluster_identifier = module.aurora.cluster_id
}

# Update DATABASE_URL to point through the proxy instead of directly at the
# cluster. This overwrites the bootstrap URL — operators don't need to touch
# Secrets Manager after apply.
#
# Commented out by default: requires a code-level decision on whether to
# route through RDS Proxy or directly. Flip to uncomment when migrating.
# resource "aws_secretsmanager_secret_version" "database_url_via_proxy" {
#   secret_id = aws_secretsmanager_secret.database_url.id
#   secret_string = format(
#     "postgresql://%s:%s@%s:5432/%s?sslmode=require",
#     var.db_master_username,
#     random_password.db_master.result,
#     aws_db_proxy.aurora.endpoint,
#     var.db_name,
#   )
# }

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint. Use this in DATABASE_URL instead of the cluster endpoint when ready to route through the proxy."
  value       = aws_db_proxy.aurora.endpoint
  sensitive   = true
}
