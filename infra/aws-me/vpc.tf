# ─────────────────────────────────────────────────────────────────────────────
# VPC — 3 AZs, public + private + database subnets, NAT per AZ for HA.
#
# me-south-1 has 3 AZs (mes1-az1, mes1-az2, mes1-az3); me-central-1 has 3 AZs
# (mec1-az1/2/3). Deploying across all 3 gives Fargate + Aurora proper HA.
#
# single_nat_gateway = false in prod — save ~$30/mo on NAT by using one
# shared NAT only if this is a staging env. For prod, pay for per-AZ NAT.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs           = slice(data.aws_availability_zones.available.names, 0, 3)
  name_prefix   = "contractor-ops-me-${var.environment}"
  # Non-overlapping CIDR with EU Render side (Render does not use VPC, but
  # reserve this range so future EU migration does not collide).
  vpc_cidr      = "10.80.0.0/16"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name = "${local.name_prefix}-vpc"
  cidr = local.vpc_cidr

  azs             = local.azs
  public_subnets  = ["10.80.0.0/20", "10.80.16.0/20", "10.80.32.0/20"]
  private_subnets = ["10.80.48.0/20", "10.80.64.0/20", "10.80.80.0/20"]
  database_subnets = ["10.80.96.0/24", "10.80.97.0/24", "10.80.98.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment == "staging"  # false in production
  one_nat_gateway_per_az = var.environment == "production"

  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group           = true
  create_database_subnet_route_table     = true
  create_database_internet_gateway_route = false

  # VPC Flow Logs → CloudWatch for audit (ME compliance frameworks care).
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
  flow_log_max_aggregation_interval    = 60
}

# ── Security groups ────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Public ALB — accepts 443 from anywhere, 80 redirects to 443."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP for redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name_prefix}-ecs-tasks"
  description = "Fargate tasks — accept from ALB only, egress anywhere (for outbound to Neon EU, Anthropic, etc.)."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "App port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "Aurora cluster — accept 5432 from ECS tasks only."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Postgres from Fargate"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # No egress needed — Aurora doesn't initiate outbound.
}
