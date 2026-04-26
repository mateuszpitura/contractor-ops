# ─────────────────────────────────────────────────────────────────────────────
# VPC endpoints — keep AWS-service traffic on the AWS backbone instead of
# egressing through NAT Gateway.
#
# Cost-driven selection:
#   - S3 Gateway endpoint         free, no reason not to include
#   - ECR api + dkr interface     saves image-pull bandwidth on every deploy
#   - Secrets Manager interface   hit on every task startup
#   - CloudWatch Logs interface   continuous log stream
#
# Skipped (cost vs. value on a small stack doesn't pay back at this scale):
#   - STS, ECS agent/telemetry, SSM, EC2 — NAT handles these cheaply enough
#     until traffic grows. Revisit when monthly NAT cost > $150.
#
# Interface endpoints cost ~$7.20/mo per endpoint per AZ. With 4 endpoints
# across 3 AZs = ~$86/mo flat. At typical deploy cadence (10 deploys/mo
# × ~500MB image × 10 tasks = 50GB ECR pull traffic) NAT would be ~$2/mo
# — the win comes from consistent latency + not hairpinning through NAT,
# not direct cost savings on a small stack.
# ─────────────────────────────────────────────────────────────────────────────

# ── Shared security group — allows tasks to talk to interface endpoints ──
resource "aws_security_group" "vpc_endpoints" {
  name        = "${local.name_prefix}-vpc-endpoints"
  description = "Interface VPC endpoints — accepts 443 from anything in the VPC."
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
    description = "HTTPS from any resource in the VPC (tasks, lambdas, etc.)"
  }
}

# ── Gateway endpoint: S3 ─────────────────────────────────────────────────
# Free. Routes added to the private subnet route tables.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = module.vpc.private_route_table_ids
}

# ── Interface endpoints ──────────────────────────────────────────────────

locals {
  interface_endpoints = toset([
    "ecr.api",          # ECR control plane
    "ecr.dkr",          # ECR docker registry (image layers)
    "secretsmanager",   # Secrets Manager
    "logs",             # CloudWatch Logs
  ])
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = local.interface_endpoints
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.${var.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true
}
