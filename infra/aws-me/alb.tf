# ─────────────────────────────────────────────────────────────────────────────
# Public ALB + HTTPS listeners. Two target groups:
#   - web  (routes app.<domain>)
#   - api  (routes api.<domain>)
#
# ACM cert is issued in the SAME region as the ALB (ALB ACM certs are
# regional, not global like CloudFront). DNS validation via Route53 records
# created in dns.tf.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "production"
  drop_invalid_header_fields = true  # defense-in-depth against header smuggling

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${local.name_prefix}-alb-logs"
  force_destroy = var.environment != "production"
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "retain-90d"
    status = "Enabled"
    expiration {
      days = 90
    }
  }
}

# Bucket policy for ALB access logs.
#
# AWS changed the S3 bucket policy requirement for ALB access logs at some
# point after August 2022. Regions launched before that use a regional AWS
# account ID as the principal; regions launched after use the service
# principal `logdelivery.elasticloadbalancing.amazonaws.com`.
#
# This policy includes BOTH statement forms. The unused one is harmless
# (principal never matches), and this is the only way to be safe without
# branching on region — the region-launch-date list drifts as AWS adds new
# regions.
#
# References:
#   https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html

data "aws_elb_service_account" "main" {}

locals {
  # Regions launched on/after Aug-2022 use the service-principal pattern.
  # Maintain this list as AWS adds regions; unknown regions default to the
  # legacy pattern which also works in older regions.
  alb_log_service_principal_regions = [
    "me-central-1",        # UAE — Aug 2022
    "ap-southeast-3",      # Jakarta — Dec 2021 (borderline; included for safety)
    "ap-south-2",          # Hyderabad — Nov 2022
    "ap-southeast-4",      # Melbourne — Jan 2023
    "eu-central-2",        # Zurich — Nov 2022
    "eu-south-2",          # Spain — Nov 2022
    "il-central-1",        # Tel Aviv — Aug 2023
    "ca-west-1",           # Calgary — Dec 2023
  ]
  alb_log_use_service_principal = contains(local.alb_log_service_principal_regions, var.region)
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = local.alb_log_use_service_principal ? [
      {
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/*"
      },
    ] : [
      {
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.main.arn }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/*"
      },
    ]
  })
}

# ── ACM certificate ────────────────────────────────────────────────────────
# Covers both app.<domain> and api.<domain> via SAN.
resource "aws_acm_certificate" "this" {
  domain_name       = "${var.app_subdomain}.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [
    "${var.api_subdomain}.${var.domain_name}",
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ── Target groups ──────────────────────────────────────────────────────────

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"  # required for Fargate
  vpc_id      = module.vpc.vpc_id

  health_check {
    enabled             = true
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

resource "aws_lb_target_group" "public_api" {
  name        = "${local.name_prefix}-api"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = module.vpc.vpc_id

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    matcher             = "200"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# ── Listeners ──────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.this.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.public_api.arn
  }

  condition {
    host_header {
      values = ["${var.api_subdomain}.${var.domain_name}"]
    }
  }
}
