# ─────────────────────────────────────────────────────────────────────────────
# Application secrets — one Secrets Manager entry holding a JSON blob of
# everything that the app reads at runtime (Better Auth, Stripe, Anthropic,
# HMRC, etc.).
#
# The task definition injects the entire JSON as the APP_SECRETS env var;
# a small bootstrap (see packages/validators/src/env.ts) parses it and maps
# keys to process.env (matching the existing .env schema). Alternative: reference
# each secret individually in the task definition's `secrets` array —
# cleaner but produces one Secrets Manager secret per key (~30 secrets =
# $12/mo at $0.40 per secret). JSON blob keeps it at one secret.
#
# Rotate any secret: update the JSON in Secrets Manager + force a new ECS
# deployment (`aws ecs update-service --force-new-deployment`).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.name_prefix}-app-secrets"
  description             = "JSON blob of all runtime secrets for the ME stack. See README for the expected schema."
  recovery_window_in_days = 30
}

# Bootstrap with a stub. Operators fill in real values via the AWS console or
# `aws secretsmanager put-secret-value` AFTER the first apply completes.
# Terraform does NOT manage the values on subsequent applies (ignore_changes)
# so rotations in the console are not reverted.
# Bootstrap keys MUST match local.app_secret_keys in ecs.tf. Each top-level
# key becomes an env var on the ECS task (via the `secrets` block with JSON
# key selector). Values are placeholders; real values go in via the AWS
# console or `aws secretsmanager put-secret-value` after first apply.
#
# Non-secret values (URLs, APP_NAME, INFISICAL_SITE_URL) are NOT here —
# they live in local.common_env in ecs.tf (no rotation needed).
resource "aws_secretsmanager_secret_version" "app_secrets_bootstrap" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    # Auth + crypto
    BETTER_AUTH_SECRET          = "TODO_replace_after_first_apply"
    API_KEY_HMAC_SECRET         = "TODO_replace_after_first_apply"
    BANK_ACCOUNT_ENCRYPTION_KEY = "TODO_replace_after_first_apply"
    SLACK_TOKEN_ENCRYPTION_KEY  = "TODO_replace_after_first_apply"
    CRON_SECRET                 = "TODO_replace_after_first_apply"

    # Billing
    STRIPE_SECRET_KEY     = "TODO_replace_after_first_apply"
    STRIPE_WEBHOOK_SECRET = "TODO_replace_after_first_apply"

    # Services
    ANTHROPIC_API_KEY    = "TODO_replace_after_first_apply"
    RESEND_API_KEY       = "TODO_replace_after_first_apply"
    RESEND_WEBHOOK_SECRET = "TODO_replace_after_first_apply"
    EMAIL_FROM           = "noreply@${var.domain_name}"

    # OAuth
    GOOGLE_CLIENT_ID        = "TODO_replace_after_first_apply"
    GOOGLE_CLIENT_SECRET    = "TODO_replace_after_first_apply"
    MICROSOFT_CLIENT_ID     = "TODO_replace_after_first_apply"
    MICROSOFT_CLIENT_SECRET = "TODO_replace_after_first_apply"

    # Queue (Upstash — migrate to local ElastiCache when app refactor lands)
    QSTASH_TOKEN               = "TODO_replace_after_first_apply"
    QSTASH_CURRENT_SIGNING_KEY = "TODO_replace_after_first_apply"
    QSTASH_NEXT_SIGNING_KEY    = "TODO_replace_after_first_apply"

    # Cache — populate REDIS_URL after elasticache.tf applies. Upstash kept
    # as fallback until the @upstash/redis → ioredis code refactor (TECH-DEBT #1).
    REDIS_URL                = "TODO_replace_with_elasticache_url_after_apply"
    UPSTASH_REDIS_REST_URL   = "TODO_replace_after_first_apply"
    UPSTASH_REDIS_REST_TOKEN = "TODO_replace_after_first_apply"

    # Observability
    SENTRY_DSN = var.sentry_dsn
    AXIOM_TOKEN            = "TODO_replace_after_first_apply"
    CRONITOR_API_KEY       = "TODO_replace_after_first_apply"

    # Feature flags — set after Unleash service comes up in the private net
    UNLEASH_URL_ME       = "http://unleash.contractor-ops-me.local:4242/api/"
    UNLEASH_API_TOKEN_ME = "TODO_create_in_unleash_admin_UI"

    # Secret store — separate Infisical project for ME tenants
    INFISICAL_CLIENT_ID     = "TODO_replace_after_first_apply"
    INFISICAL_CLIENT_SECRET = "TODO_replace_after_first_apply"
    INFISICAL_PROJECT_ID    = "TODO_replace_with_me_project_id"
  })

  lifecycle {
    # Terraform only sets the placeholder JSON on first apply. Operators
    # manage real values via the AWS console; subsequent applies never
    # overwrite them.
    ignore_changes = [secret_string]
  }
}
