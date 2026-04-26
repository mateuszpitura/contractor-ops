# ─────────────────────────────────────────────────────────────────────────────
# Route53 records — the hosted zone itself is NOT managed by Terraform.
# Create the zone once in the AWS account (or delegate from another registrar)
# and pass its domain name via var.domain_name.
#
# If the zone does not exist yet, `terraform apply` will fail at the data
# lookup below — that is intentional to prevent accidental zone creation /
# orphaning.
# ─────────────────────────────────────────────────────────────────────────────

data "aws_route53_zone" "this" {
  name         = var.domain_name
  private_zone = false
}

# ── ALB alias records ─────────────────────────────────────────────────────

resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.app_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "public_api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

# ── ACM DNS validation records ────────────────────────────────────────────

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}
