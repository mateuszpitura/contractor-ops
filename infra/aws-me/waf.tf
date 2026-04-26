# ─────────────────────────────────────────────────────────────────────────────
# AWS WAF — attached to the ALB.
#
# Three rule blocks, evaluated in priority order:
#   1. AWSManagedRulesCommonRuleSet   OWASP-ish baseline (XSS, RFI, LFI, etc.)
#   2. AWSManagedRulesKnownBadInputsRuleSet  known malicious request patterns
#   3. Rate-based rule — per-IP throttle to match Upstash rate limiter's
#      intent at the edge (cheaper than hitting rate limiter middleware).
#
# SQLi / Linux / Unix managed rules can be added if a specific threat model
# emerges. Keep the rule count small — each rule evaluates on every request
# and costs $1/mo per rule + $0.60/million evaluations.
#
# ME compliance frameworks (Saudi NDMO, UAE NESA) expect a documented WAF
# on all public endpoints. This satisfies that without adding vendor lock-in.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_wafv2_web_acl" "this" {
  name        = "${local.name_prefix}-waf"
  description = "Web ACL for the ME ALB — baseline OWASP + rate limit."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # 1. Common rule set — OWASP top-10 baseline.
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # SizeRestrictions_BODY trips on Next.js RSC payloads / Prisma
        # queries with large filter trees. Counted (not blocked) by default
        # so we don't block legitimate traffic while tuning.
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use {
            count {}
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-waf-common"
      sampled_requests_enabled   = true
    }
  }

  # 2. Known bad inputs — exploits + known attack signatures.
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-waf-known-bad"
      sampled_requests_enabled   = true
    }
  }

  # 3. Rate-based rule — per-IP throttle, 5-minute sliding window.
  #    2000 req/5min = ~6.7 req/sec per IP. Tune after observing real
  #    traffic (normal users rarely exceed 1 req/s sustained).
  rule {
    name     = "RateLimitPerIP"
    priority = 30

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-waf-ratelimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

# ── Alarm: sustained block rate (potential attack) ───────────────────────

resource "aws_cloudwatch_metric_alarm" "waf_blocks" {
  alarm_name          = "${local.name_prefix}-waf-high-block-rate"
  alarm_description   = "WAF BlockedRequests > 100/min for 10 minutes — investigate attack or tune rule (false positives)."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 500
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.this.name
    Region = var.region
    Rule   = "ALL"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
