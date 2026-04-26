# ─────────────────────────────────────────────────────────────────────────────
# ECS Fargate cluster + 3 services: web, public-api, worker.
#
# Each service has its own task definition. Secrets come from Secrets Manager
# (referenced by ARN — values never hit the task definition JSON). Non-secret
# env comes from the plaintext `environment` block.
#
# Web and public-api register with ALB target groups; worker has no ingress.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # Web + public-api run on on-demand for availability SLA; worker can use
  # SPOT since it's a single-instance scheduler that node-cron will re-run
  # if interrupted.
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ── IAM roles ──────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role — pulls ECR images + fetches secrets at task startup.
resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.db_master.arn,
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.app_secrets.arn,
      ]
    }]
  })
}

# Task role — permissions the RUNNING app code has (S3, Bedrock, etc.).
# Kept minimal; add specific statements as features land.
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [
        aws_s3_bucket.documents.arn,
        "${aws_s3_bucket.documents.arn}/*",
      ]
    }]
  })
}

# ── Document bucket (replaces Cloudflare R2 for ME tenants) ───────────────
resource "aws_s3_bucket" "documents" {
  bucket = "${local.name_prefix}-documents"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ── CloudWatch log groups ─────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}/web"
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_cloudwatch_log_group" "public_api" {
  name              = "/ecs/${local.name_prefix}/public-api"
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}/worker"
  retention_in_days = var.cloudwatch_log_retention_days
}

# ── Task definitions ──────────────────────────────────────────────────────

locals {
  # ── Non-secret env for all tasks ─────────────────────────────────────────
  # These values are known at deploy time and never rotate. Kept out of
  # Secrets Manager so operators can tweak them without touching secret
  # rotation flows.
  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "DATA_HOSTING_REGION", value = "ME" },
    { name = "AWS_REGION", value = var.region },
    { name = "LOG_LEVEL", value = "info" },
    { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
    { name = "R2_BUCKET_NAME_ME", value = aws_s3_bucket.documents.id },
    { name = "SENTRY_ENVIRONMENT", value = "me-${var.environment}" },
    { name = "APP_URL", value = "https://${var.app_subdomain}.${var.domain_name}" },
    { name = "NEXT_PUBLIC_APP_URL", value = "https://${var.app_subdomain}.${var.domain_name}" },
    { name = "BETTER_AUTH_URL", value = "https://${var.app_subdomain}.${var.domain_name}" },
    { name = "UNLEASH_APP_NAME", value = "contractor-ops" },
    { name = "UNLEASH_ENVIRONMENT", value = "production" },
    { name = "INFISICAL_SITE_URL", value = "https://app.infisical.com" },
    { name = "INFISICAL_ENVIRONMENT", value = "production" },
    { name = "AXIOM_DATASET", value = "contractor-ops-me" },
    # Internal service discovery — app reaches ClamAV over the VPC private DNS.
    { name = "CLAMAV_HOST", value = "clamav.${aws_service_discovery_private_dns_namespace.internal.name}" },
    { name = "CLAMAV_PORT", value = "3310" },
  ]

  # ── Secret keys injected from the app-secrets JSON blob ──────────────────
  # Each key here resolves to one environment variable on the task, populated
  # by Secrets Manager using the ARN:KEY:: selector syntax. This avoids the
  # earlier mistake of dumping the full JSON blob as a single APP_SECRETS var
  # (app code expects individual env vars like process.env.BETTER_AUTH_SECRET).
  #
  # When adding a new secret to the app: add the key here AND to the bootstrap
  # object in secrets.tf. Mismatches are caught only at task startup.
  app_secret_keys = [
    "BETTER_AUTH_SECRET",
    "API_KEY_HMAC_SECRET",
    "BANK_ACCOUNT_ENCRYPTION_KEY",
    "SLACK_TOKEN_ENCRYPTION_KEY",
    "CRON_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "EMAIL_FROM",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "NEXT_PUBLIC_SENTRY_DSN",
    "AXIOM_TOKEN",
    "CRONITOR_API_KEY",
    "UNLEASH_URL_ME",
    "UNLEASH_API_TOKEN_ME",
    "INFISICAL_CLIENT_ID",
    "INFISICAL_CLIENT_SECRET",
    "INFISICAL_PROJECT_ID",
    # Redis — populated by elasticache.tf after the cluster is up. Upstash
    # fallback kept during the in-flight migration away from @upstash/redis.
    "REDIS_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]

  common_secrets = concat(
    [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url.arn
      },
      {
        name      = "DATABASE_URL_ME"
        valueFrom = aws_secretsmanager_secret.database_url.arn
      },
    ],
    [
      for key in local.app_secret_keys : {
        name      = key
        valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:${key}::"
      }
    ],
  )
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.this[var.ecr_repo_web].repository_url}:${var.image_tag}"
    essential = true
    command   = ["node", "apps/web/server.js"]

    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]

    environment = local.common_env
    secrets     = local.common_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.web.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "web"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 30
    }
  }])
}

resource "aws_ecs_task_definition" "public_api" {
  family                   = "${local.name_prefix}-public-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.public_api_cpu
  memory                   = var.public_api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "public-api"
    image     = "${aws_ecr_repository.this[var.ecr_repo_public_api].repository_url}:${var.image_tag}"
    essential = true
    command   = ["node", "apps/public-api/dist/index.js"]

    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]

    environment = local.common_env
    secrets     = local.common_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.public_api.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "public-api"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.this[var.ecr_repo_worker].repository_url}:${var.image_tag}"
    essential = true
    command   = ["node", "apps/web/worker-cron.mjs"]

    environment = local.common_env
    secrets     = local.common_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

# ── Services ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "public_api" {
  name            = "${local.name_prefix}-public-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.public_api.arn
  desired_count   = var.public_api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.public_api.arn
    container_name   = "public-api"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.https]
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1  # node-cron is single-instance-safe only
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # Worker should not run two copies during deploy — otherwise crons fire
  # twice. Block parallelism by forcing 0→1→0 replacement.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
}

# ── Autoscaling for web + public-api ──────────────────────────────────────

resource "aws_appautoscaling_target" "web" {
  max_capacity       = 8
  min_capacity       = var.web_desired_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${local.name_prefix}-web-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_target" "public_api" {
  max_capacity       = 6
  min_capacity       = var.public_api_desired_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.public_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "public_api_cpu" {
  name               = "${local.name_prefix}-public-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.public_api.resource_id
  scalable_dimension = aws_appautoscaling_target.public_api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.public_api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
