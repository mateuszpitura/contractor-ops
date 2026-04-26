# ─────────────────────────────────────────────────────────────────────────────
# Cloudflare Tunnel — on-demand Zero Trust access to private admin UIs
# (Unleash, ClamAV metrics, DB via psql-over-TCP, etc.).
#
# Same pattern as Render: single cloudflared Fargate task with
# desired_count = 0 by default. An operator scales to 1 when they need
# access, back to 0 afterward. While at 0 = no billing on ECS for this task.
#
# Alternative considered: AWS Client VPN. Rejected for this stack because:
#   - Client VPN has ~$73/mo baseline (endpoint hours) regardless of use,
#     which defeats the on-demand goal.
#   - SSO integration with Client VPN requires federated SAML setup per
#     IdP; we already have Google Workspace wired to Cloudflare Access.
#   - Cloudflare Access integrates identity + audit log + device posture
#     in one place, matching the Render side.
#   - If the customer contract specifically mandates "access via VPN" as
#     a compliance control, flip to Client VPN by setting
#     `use_client_vpn = true` in the module interface (not implemented in
#     this skeleton — add if actually required).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "cloudflared" {
  name              = "/ecs/${local.name_prefix}/cloudflared"
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_secretsmanager_secret" "cloudflare_tunnel_token" {
  name                    = "${local.name_prefix}-cloudflare-tunnel-token"
  description             = "Cloudflare Tunnel token (Zero Trust dashboard → Networks → Tunnels)."
  recovery_window_in_days = 30
}

# No secret_version in Terraform — operator pastes the token into the
# console once. Terraform should not hold production Cloudflare credentials
# in state.

resource "aws_iam_role_policy" "cloudflared_execution_secrets" {
  name = "${local.name_prefix}-cloudflared-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.cloudflare_tunnel_token.arn]
    }]
  })
}

resource "aws_security_group" "cloudflared" {
  name        = "${local.name_prefix}-cloudflared"
  description = "cloudflared task — egress-only (tunnel is outbound to Cloudflare)."
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Allow cloudflared to reach private services (Unleash, ClamAV) — Cloudflare
# Tunnel routes Access traffic to these hostnames internally.
resource "aws_security_group_rule" "unleash_from_cloudflared" {
  type                     = "ingress"
  from_port                = 4242
  to_port                  = 4242
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.cloudflared.id
  security_group_id        = aws_security_group.unleash.id
  description              = "Cloudflare Tunnel reaches Unleash admin UI."
}

resource "aws_ecs_task_definition" "cloudflared" {
  family                   = "${local.name_prefix}-cloudflared"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "cloudflared"
    image     = "docker.io/cloudflare/cloudflared:2026.3.0"
    essential = true
    command   = ["tunnel", "--no-autoupdate", "--metrics", "0.0.0.0:2000", "run"]

    secrets = [
      {
        name      = "TUNNEL_TOKEN"
        valueFrom = aws_secretsmanager_secret.cloudflare_tunnel_token.arn
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.cloudflared.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "cloudflared"
      }
    }
  }])
}

resource "aws_ecs_service" "cloudflared" {
  name            = "${local.name_prefix}-cloudflared"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.cloudflared.arn
  desired_count   = 0  # suspended by default — resume via CLI when admin access is needed
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.cloudflared.id]
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  # Ignore desired_count drift — operators scale this to 1 and back to 0
  # outside of Terraform. Without this, every `terraform apply` would fight
  # the operator's manual scaling.
  lifecycle {
    ignore_changes = [desired_count]
  }
}
