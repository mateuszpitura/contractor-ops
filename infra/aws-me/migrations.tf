# ─────────────────────────────────────────────────────────────────────────────
# Migration / bastion task — one-off Fargate task for running Prisma
# migrations, seeding Unleash DB, manual psql work, etc.
#
# Usage pattern:
#
#   # Interactive psql shell (SSM Session Manager ExecuteCommand):
#   aws ecs run-task \
#     --cluster contractor-ops-me-production-cluster \
#     --task-definition contractor-ops-me-production-migrator \
#     --launch-type FARGATE \
#     --enable-execute-command \
#     --network-configuration "awsvpcConfiguration={subnets=[subnet-...],securityGroups=[sg-...],assignPublicIp=DISABLED}"
#
#   # Wait until the task is running, then exec:
#   aws ecs execute-command \
#     --cluster contractor-ops-me-production-cluster \
#     --task <task-id> \
#     --container migrator \
#     --command "/bin/sh" \
#     --interactive
#
# Inside the shell, the container has psql + pnpm + the repo baked in, plus
# DATABASE_URL in the env. Run `pnpm prisma migrate deploy`, `psql "$DATABASE_URL"`,
# or any ad-hoc SQL needed.
#
# The task does nothing on its own (sleep infinity). It exists only so an
# operator can exec into it. ECS Execute Command requires:
#   - Task role permits ssmmessages:*
#   - enable-execute-command on run-task
# Both are wired below.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "migrator" {
  name              = "/ecs/${local.name_prefix}/migrator"
  retention_in_days = var.cloudwatch_log_retention_days
}

# Task role with SSM exec permissions.
resource "aws_iam_role_policy" "ecs_task_ssm_exec" {
  name = "${local.name_prefix}-ecs-task-ssm-exec"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_ecs_task_definition" "migrator" {
  family                   = "${local.name_prefix}-migrator"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "migrator"
    # Reuse the web image — it already has @contractor-ops/db + pnpm +
    # prisma-cli in the standalone bundle. Saves building a separate
    # migrator image.
    image     = "${aws_ecr_repository.this[var.ecr_repo_web].repository_url}:${var.image_tag}"
    essential = true

    # Sleep forever so the task stays running for exec.
    command = ["sh", "-c", "while true; do sleep 3600; done"]

    environment = local.common_env
    secrets     = local.common_secrets

    # Must be explicitly enabled on both the task def AND the run-task call
    # for SSM Session Manager exec to attach.
    linuxParameters = {
      initProcessEnabled = true
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migrator.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "migrator"
      }
    }
  }])
}
