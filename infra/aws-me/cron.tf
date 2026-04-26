# ─────────────────────────────────────────────────────────────────────────────
# Cron jobs — EventBridge Scheduler invokes ECS RunTask for each job.
#
# Two schedules mirror the Render Blueprint:
#   - cron-token-refresh   */15 * * * *  (OAuth refresh, critical)
#   - cron-data-purge      0 3 * * *     (GDPR purge, daily 03:00 UTC)
#
# Each schedule runs a small curl-based Fargate task that calls the web
# service's /api/cron/* endpoint. Identical pattern to the Render crons,
# translated to AWS primitives. Using EventBridge Scheduler (not Rules) —
# Scheduler is the modern service with per-region quotas, better retry
# semantics, and direct ECS RunTask target support.
#
# The curl tasks run in the same VPC as the web service and reach it via the
# public ALB DNS (AWS routes same-region traffic internally — no NAT egress).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "cron" {
  name              = "/ecs/${local.name_prefix}/cron"
  retention_in_days = var.cloudwatch_log_retention_days
}

# ── Curl task definition — reused by both schedules ──────────────────────

resource "aws_ecs_task_definition" "cron_curl" {
  family                   = "${local.name_prefix}-cron-curl"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "curl"
    image     = "docker.io/curlimages/curl:8.19.0"
    essential = true

    # The actual URL + header are passed via `overrides` in EventBridge
    # Scheduler — keeps the task definition generic. Bootstrap placeholder
    # so the task def is valid on apply; real args come from scheduler.
    command = ["--version"]

    secrets = [
      {
        name      = "CRON_SECRET"
        valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:CRON_SECRET::"
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.cron.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "curl"
      }
    }
  }])
}

# ── IAM role for EventBridge Scheduler to run ECS tasks ──────────────────

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name_prefix}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "scheduler_runtask" {
  name = "${local.name_prefix}-scheduler-runtask"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = [
          aws_ecs_task_definition.cron_curl.arn_without_revision,
          "${aws_ecs_task_definition.cron_curl.arn_without_revision}:*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
      },
    ]
  })
}

# ── Schedule: token refresh every 15 minutes ─────────────────────────────

locals {
  web_url = "https://${var.app_subdomain}.${var.domain_name}"

  # Curl override args common to every cron job. Keep the -m (max time) low
  # enough to fit within Scheduler's 15-minute max task window, high enough
  # for OAuth bulk refresh jobs to finish.
  curl_cmd_template = [
    "-fsS", "-m", "600",
    "-H", "Authorization: Bearer $CRON_SECRET",
  ]
}

resource "aws_scheduler_schedule" "token_refresh" {
  name        = "${local.name_prefix}-token-refresh"
  description = "OAuth token refresh — every 15 minutes. Mirrors Render cron-token-refresh."

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(*/15 * * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_ecs_cluster.this.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.cron_curl.arn
      launch_type         = "FARGATE"
      task_count          = 1

      network_configuration {
        subnets          = module.vpc.private_subnets
        security_groups  = [aws_security_group.ecs_tasks.id]
        assign_public_ip = false
      }
    }

    # Override the container command with the actual curl invocation.
    input = jsonencode({
      containerOverrides = [{
        name = "curl"
        command = concat(
          local.curl_cmd_template,
          ["${local.web_url}/api/cron/token-refresh"],
        )
      }]
    })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 3600
    }
  }
}

# ── Schedule: GDPR data purge daily 03:00 UTC ────────────────────────────

resource "aws_scheduler_schedule" "data_purge" {
  name        = "${local.name_prefix}-data-purge"
  description = "GDPR data purge — daily 03:00 UTC. Mirrors Render cron-data-purge."

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 3 * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_ecs_cluster.this.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.cron_curl.arn
      launch_type         = "FARGATE"
      task_count          = 1

      network_configuration {
        subnets          = module.vpc.private_subnets
        security_groups  = [aws_security_group.ecs_tasks.id]
        assign_public_ip = false
      }
    }

    input = jsonencode({
      containerOverrides = [{
        name = "curl"
        command = concat(
          local.curl_cmd_template,
          ["${local.web_url}/api/cron/data-purge"],
        )
      }]
    })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 3600
    }
  }
}

# ── Alarm: schedule invocation failure ───────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cron_failures" {
  for_each = {
    token_refresh = aws_scheduler_schedule.token_refresh.name
    data_purge    = aws_scheduler_schedule.data_purge.name
  }

  alarm_name          = "${local.name_prefix}-cron-${each.key}-failed"
  alarm_description   = "EventBridge Scheduler failed to invoke the ${each.key} cron target. Missing invocations → OAuth tokens expire / GDPR purge skipped."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "TargetErrorCount"
  namespace           = "AWS/Scheduler"
  period              = 900
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ScheduleName = each.value
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
