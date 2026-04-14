# ─────────────────────────────────────────────────────────────────────────────
# Unleash (ME) — self-hosted feature flags for ME tenants.
#
# Uses the SAME Aurora cluster as the app with a separate database_name.
# Sharing the cluster saves ~$85/mo vs a second Serverless v2 cluster; the
# separate DB keeps Unleash schema migrations from touching the app schema.
#
# ECS service is private-only (internal SG, no ALB listener) — admin UI
# access goes through the Cloudflare Tunnel in admin-tunnel.tf. App tasks
# reach Unleash at its service discovery name on port 4242.
# ─────────────────────────────────────────────────────────────────────────────

# Create a dedicated DB inside the shared Aurora cluster for Unleash.
# This uses the Postgres provider to issue CREATE DATABASE after Aurora comes
# up; it needs the cluster endpoint and master credentials, which Aurora
# exports. The provider block lives inline so consumers of this module don't
# need to configure it globally.

resource "aws_cloudwatch_log_group" "unleash" {
  name              = "/ecs/${local.name_prefix}/unleash"
  retention_in_days = var.cloudwatch_log_retention_days
}

# Random password for the Unleash-specific DB user (least-privilege; cannot
# touch the app schema).
resource "random_password" "unleash_db" {
  length           = 48
  special          = true
  override_special = "!#$%&*()-_+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "unleash_database_url" {
  name                    = "${local.name_prefix}-unleash-database-url"
  description             = "Connection URL for Unleash (separate DB on the shared Aurora cluster)."
  recovery_window_in_days = 30
}

# NOTE: the Unleash DB + user must be CREATEd on the cluster on first
# provision. Do this once via a one-off psql shell (SSM Session Manager into
# a bastion task, or a migration task):
#
#   CREATE DATABASE unleash;
#   CREATE USER unleash_app WITH PASSWORD '<random_password.unleash_db>';
#   GRANT ALL PRIVILEGES ON DATABASE unleash TO unleash_app;
#
# After that, set the secret value to the final libpq URL. This is kept as a
# manual step rather than a postgresql_database / _role Terraform resource
# because adding the postgresql provider requires reaching the cluster from
# wherever terraform runs — which in turn needs SSM tunneling or a bastion.
# Simpler to document the one-time bootstrap.
resource "aws_secretsmanager_secret_version" "unleash_database_url_bootstrap" {
  secret_id = aws_secretsmanager_secret.unleash_database_url.id
  secret_string = format(
    "postgresql://unleash_app:%s@%s:5432/unleash?sslmode=require",
    random_password.unleash_db.result,
    module.aurora.cluster_endpoint,
  )

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Service discovery — lets app tasks reach Unleash at a stable hostname
# (unleash.contractor-ops-me.local:4242) instead of a changing private IP.
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "contractor-ops-me.local"
  description = "Private service discovery for the ME stack."
  vpc         = module.vpc.vpc_id
}

resource "aws_service_discovery_service" "unleash" {
  name = "unleash"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id
    dns_records {
      type = "A"
      ttl  = 10
    }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# Dedicated IAM policy attachment — Unleash execution role can only read
# its own secrets (DB URL + admin init tokens).
resource "aws_iam_role_policy" "unleash_execution_secrets" {
  name = "${local.name_prefix}-unleash-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.unleash_database_url.arn]
    }]
  })
}

resource "aws_ecs_task_definition" "unleash" {
  family                   = "${local.name_prefix}-unleash"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "unleash"
    image     = "docker.io/unleashorg/unleash-server:7"
    essential = true

    portMappings = [{
      containerPort = 4242
      hostPort      = 4242
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "DATABASE_SSL", value = "true" },
      { name = "LOG_LEVEL", value = "info" },
    ]

    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.unleash_database_url.arn
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.unleash.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "unleash"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:4242/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])
}

# Allow ECS app tasks to reach Unleash on 4242.
resource "aws_security_group_rule" "unleash_from_app" {
  type                     = "ingress"
  from_port                = 4242
  to_port                  = 4242
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.unleash.id
  description              = "Unleash accepts HTTP only from the app Fargate tasks."
}

resource "aws_security_group" "unleash" {
  name        = "${local.name_prefix}-unleash"
  description = "Unleash ECS service — private, no public ingress."
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_service" "unleash" {
  name            = "${local.name_prefix}-unleash"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.unleash.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.unleash.id]
  }

  service_registries {
    registry_arn = aws_service_discovery_service.unleash.arn
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
}
