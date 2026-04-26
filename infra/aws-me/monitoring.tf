# ─────────────────────────────────────────────────────────────────────────────
# CloudWatch alarms — minimal set, enough to page oncall on real incidents
# without alert fatigue. Tune after two weeks of baseline traffic.
#
# SNS topic sends to your existing paging provider (PagerDuty, Opsgenie) —
# subscribe it manually after first apply, subscription confirmation cannot
# be fully automated in Terraform without storing a PD integration key here.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
}

# 5xx rate on the ALB — covers both web and public-api.
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx"
  alarm_description   = "5xx response rate on the public ALB exceeded 1% over 5 minutes."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0.01
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "m2 / IF(m1 == 0, 1, m1)"
    label       = "5xx rate"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_lb.this.arn_suffix
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = aws_lb.this.arn_suffix
      }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# Aurora Serverless v2 running at max ACU — capacity exhausted = needs bump.
resource "aws_cloudwatch_metric_alarm" "aurora_max_capacity" {
  alarm_name          = "${local.name_prefix}-aurora-at-max"
  alarm_description   = "Aurora Serverless v2 cluster is sitting at max_capacity. Either db_max_capacity needs raising or a query is pathological."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "ServerlessDatabaseCapacity"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.db_max_capacity * 0.95
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = module.aurora.cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Worker task stopped — node-cron is single-instance; if ECS kills it and
# fails to restart, crons silently stop firing.
resource "aws_cloudwatch_metric_alarm" "worker_not_running" {
  alarm_name          = "${local.name_prefix}-worker-not-running"
  alarm_description   = "Worker ECS service has 0 running tasks. Cron jobs are paused until this recovers."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.worker.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ALB unhealthy targets — catches backends that return 2xx on /health but
# fail real traffic, or recently deployed broken commits.
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  for_each = {
    web        = aws_lb_target_group.web.arn_suffix
    public_api = aws_lb_target_group.public_api.arn_suffix
  }

  alarm_name          = "${local.name_prefix}-alb-${each.key}-unhealthy"
  alarm_description   = "One or more ${each.key} target hosts are unhealthy for 5+ minutes. Either a deploy broke /health or a task is OOMing."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = each.value
    LoadBalancer = aws_lb.this.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ALB p95 latency — catches slowdowns before they turn into 5xx timeouts.
resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${local.name_prefix}-alb-p95-latency"
  alarm_description   = "ALB p95 target response time > 2s for 10 minutes. Slow-query / cold-start / dependency degradation likely."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 2.0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.this.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Fargate memory saturation — OOM is silent on ECS (task just dies).
# Alarm at 90% catches it before the kill + redeploy cycle.
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  for_each = {
    web        = aws_ecs_service.web.name
    public_api = aws_ecs_service.public_api.name
    worker     = aws_ecs_service.worker.name
    unleash    = aws_ecs_service.unleash.name
    clamav     = aws_ecs_service.clamav.name
  }

  alarm_name          = "${local.name_prefix}-${each.key}-memory-high"
  alarm_description   = "ECS service ${each.key} memory utilization > 90%. Risk of Fargate killing the container with SIGKILL."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 90
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = each.value
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Aurora CPU — Serverless v2 scales on memory pressure, not CPU. Hot CPU
# usually means a missing index or a runaway query.
resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "${local.name_prefix}-aurora-cpu-high"
  alarm_description   = "Aurora CPU > 80% sustained. Usually a missing index or lock contention — check Performance Insights."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = module.aurora.cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# Aurora deadlocks — any is suspicious and worth investigating, most app
# bugs that cause deadlocks also cause data corruption.
resource "aws_cloudwatch_metric_alarm" "aurora_deadlocks" {
  alarm_name          = "${local.name_prefix}-aurora-deadlocks"
  alarm_description   = "Aurora detected deadlocks. Likely a transaction-ordering bug; check recent deploys."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Deadlocks"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBClusterIdentifier = module.aurora.cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ── Cost guard ───────────────────────────────────────────────────────────
# Budget alert — this stack sits dormant 99% of the time. If something
# autoscales pathologically (runaway Fargate, NAT transfer loop) a budget
# alarm catches it faster than the monthly bill review.

resource "aws_budgets_budget" "me_stack" {
  name              = "${local.name_prefix}-monthly"
  budget_type       = "COST"
  limit_amount      = "500"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2025-01-01_00:00"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Stack$aws-me"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
  }
}
