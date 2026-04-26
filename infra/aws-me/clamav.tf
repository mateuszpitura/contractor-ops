# ─────────────────────────────────────────────────────────────────────────────
# ClamAV (ME) — virus scanner for document uploads.
#
# Fargate does not support persistent local storage, so ClamAV signatures
# (~300MB on disk, ~1GB loaded into RAM) live on EFS. Without EFS the task
# would re-download the full signature DB from freshclam on every restart,
# which takes 3–5 min and violates ClamAV's signature-update rate limits.
#
# Reached by app tasks at clamav.contractor-ops-me.local:3310 via service
# discovery. No public ingress.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "clamav" {
  name              = "/ecs/${local.name_prefix}/clamav"
  retention_in_days = var.cloudwatch_log_retention_days
}

# EFS filesystem for ClamAV signatures.
resource "aws_efs_file_system" "clamav" {
  creation_token = "${local.name_prefix}-clamav"
  encrypted      = true

  # Bursting throughput is fine — freshclam writes ~300MB once every 15 min,
  # ClamAV reads are cached in RAM after startup.
  throughput_mode = "bursting"

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
}

# One mount target per private subnet AZ, so the Fargate task can mount EFS
# regardless of which AZ it lands in.
resource "aws_efs_mount_target" "clamav" {
  for_each        = toset(module.vpc.private_subnets)
  file_system_id  = aws_efs_file_system.clamav.id
  subnet_id       = each.value
  security_groups = [aws_security_group.efs.id]
}

resource "aws_security_group" "efs" {
  name        = "${local.name_prefix}-efs"
  description = "EFS — NFS (2049) from ECS tasks only."
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.clamav.id]
    description     = "NFS from the ClamAV Fargate task."
  }
}

resource "aws_security_group" "clamav" {
  name        = "${local.name_prefix}-clamav"
  description = "ClamAV ECS service — accepts 3310 from app tasks."
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "clamav_from_app" {
  type                     = "ingress"
  from_port                = 3310
  to_port                  = 3310
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.clamav.id
  description              = "clamd accepts scan requests from the app Fargate tasks."
}

resource "aws_service_discovery_service" "clamav" {
  name = "clamav"

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

resource "aws_ecs_task_definition" "clamav" {
  family                   = "${local.name_prefix}-clamav"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  # ClamAV needs ~1GB RAM for signatures + working buffer. 2GB gives headroom.
  cpu                      = 512
  memory                   = 2048
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  volume {
    name = "clamav-signatures"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.clamav.id
      transit_encryption = "ENABLED"
    }
  }

  container_definitions = jsonencode([{
    name      = "clamav"
    image     = "docker.io/clamav/clamav:stable"
    essential = true

    portMappings = [{
      containerPort = 3310
      hostPort      = 3310
      protocol      = "tcp"
    }]

    mountPoints = [{
      sourceVolume  = "clamav-signatures"
      containerPath = "/var/lib/clamav"
      readOnly      = false
    }]

    environment = [
      { name = "CLAMAV_NO_FRESHCLAMD", value = "false" },
      { name = "CLAMAV_NO_CLAMD", value = "false" },
      { name = "CLAMD_STARTUP_TIMEOUT", value = "180" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.clamav.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "clamav"
      }
    }
  }])
}

resource "aws_ecs_service" "clamav" {
  name            = "${local.name_prefix}-clamav"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.clamav.arn
  desired_count   = 1  # signatures are on shared EFS but clamd is stateful in-memory
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.clamav.id]
  }

  service_registries {
    registry_arn = aws_service_discovery_service.clamav.arn
  }

  # Don't run two clamd instances in parallel during deploy — they fight
  # over the same EFS lock files.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  depends_on = [aws_efs_mount_target.clamav]
}

# Append CLAMAV_HOST + CLAMAV_PORT to the common env so app tasks reach it
# via service discovery. Done in ecs.tf by appending to local.common_env
# would require a rewrite; instead, app tasks read these from Secrets
# Manager app-secrets (see secrets.tf — add CLAMAV_HOST = "clamav.contractor-ops-me.local"
# and CLAMAV_PORT = "3310" to the bootstrap JSON).
