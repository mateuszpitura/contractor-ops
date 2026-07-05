/**
 * Vitest global setup — runs once per worker before any test file imports.
 *
 * Required because `@contractor-ops/auth` evaluates `authEnv` at module
 * load time (line `export const authEnv = loadAuthEnv()` in
 * `packages/auth/src/env.ts`). When a test sets env vars in `beforeAll`,
 * the auth module has already been imported with the un-stubbed env →
 * Better Auth boots without a base URL → /api/auth/* returns 404 for
 * unknown routes the bridge cannot satisfy.
 *
 * Setting these here, before vitest loads any test or its imports,
 * guarantees `authEnv` sees the test values on first evaluation.
 */

// @types/node typings flag NODE_ENV as read-only. Cast through Record so the
// global env writes typecheck cleanly inside the test boot script. The cast
// is scoped to this setup file — no production code should reuse it.
const env = process.env as Record<string, string>;

env.NODE_ENV = 'test';
env.APP_URL = 'https://app.example.test';
env.API_URL = 'https://api.example.test';
env.PORT = '4000';
env.HOST = '127.0.0.1';
env.TRUSTED_PROXIES = 'loopback,linklocal,uniquelocal';
env.HEALTH_TIMEOUT_MS = '1000';

// Better Auth — minimum surface for the in-memory boot.
env.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET ?? 'test-secret-test-secret';
env.BETTER_AUTH_URL = env.BETTER_AUTH_URL ?? 'https://api.example.test';
env.PUBLIC_APP_URL = env.PUBLIC_APP_URL ?? 'https://app.example.test';

// Stripe client is constructed eagerly at module load by
// `packages/api/src/services/stripe-client.ts`; without a key it throws
// "Neither apiKey nor config.authenticator provided" before any test
// runs. The value is non-functional — billing tests mock Stripe
// directly — but having any string keeps module load alive.
env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';

// Remaining server-env credentials enforced by `validateServerEnv`
// (packages/validators/src/env.ts). The appRouter evaluates `getServerEnv()`
// at module load (stripe-client, billing-constants, ocr-extraction,
// integrations), so every `buildServer()` inject test needs the full set
// present or the validator throws at import. Values are non-functional
// placeholders — provider clients are mocked in the tests that use them —
// chosen to satisfy each field's format validator (sk_/whsec_/price_
// prefixes, 64-hex key, min-length secrets).
env.DATABASE_URL = env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
env.DATABASE_URL_EU = env.DATABASE_URL_EU ?? 'postgresql://test:test@localhost:5432/test';
env.DATABASE_URL_ME = env.DATABASE_URL_ME ?? 'postgresql://test:test@localhost:5432/test';
env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID ?? 'test-google-client-id';
env.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET ?? 'test-google-client-secret';
env.MICROSOFT_CLIENT_ID = env.MICROSOFT_CLIENT_ID ?? 'test-microsoft-client-id';
env.MICROSOFT_CLIENT_SECRET = env.MICROSOFT_CLIENT_SECRET ?? 'test-microsoft-client-secret';
env.STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_placeholder';
env.STRIPE_PRICE_STARTER = env.STRIPE_PRICE_STARTER ?? 'price_test_starter';
env.STRIPE_PRICE_PRO = env.STRIPE_PRICE_PRO ?? 'price_test_pro';
env.STRIPE_PRICE_ENTERPRISE = env.STRIPE_PRICE_ENTERPRISE ?? 'price_test_enterprise';
env.STRIPE_PRICE_TOPUP_10 = env.STRIPE_PRICE_TOPUP_10 ?? 'price_test_topup10';
env.STRIPE_PRICE_TOPUP_25 = env.STRIPE_PRICE_TOPUP_25 ?? 'price_test_topup25';
env.STRIPE_PRICE_TOPUP_50 = env.STRIPE_PRICE_TOPUP_50 ?? 'price_test_topup50';
env.RESEND_API_KEY = env.RESEND_API_KEY ?? 're_test_placeholder';
env.RESEND_WEBHOOK_SECRET = env.RESEND_WEBHOOK_SECRET ?? 'test-resend-webhook-secret';
env.R2_ACCOUNT_ID = env.R2_ACCOUNT_ID ?? 'test-r2-account';
env.R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID ?? 'test-r2-access-key';
env.R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY ?? 'test-r2-secret-key';
env.SLACK_CLIENT_ID = env.SLACK_CLIENT_ID ?? 'test-slack-client-id';
env.SLACK_CLIENT_SECRET = env.SLACK_CLIENT_SECRET ?? 'test-slack-client-secret';
env.SLACK_SIGNING_SECRET = env.SLACK_SIGNING_SECRET ?? 'test-slack-signing-secret';
env.JIRA_CLIENT_ID = env.JIRA_CLIENT_ID ?? 'test-jira-client-id';
env.JIRA_CLIENT_SECRET = env.JIRA_CLIENT_SECRET ?? 'test-jira-client-secret';
env.DOCUSIGN_CLIENT_ID = env.DOCUSIGN_CLIENT_ID ?? 'test-docusign-client-id';
env.DOCUSIGN_CLIENT_SECRET = env.DOCUSIGN_CLIENT_SECRET ?? 'test-docusign-client-secret';
env.AUTENTI_CLIENT_ID = env.AUTENTI_CLIENT_ID ?? 'test-autenti-client-id';
env.AUTENTI_CLIENT_SECRET = env.AUTENTI_CLIENT_SECRET ?? 'test-autenti-client-secret';
env.NOTION_CLIENT_ID = env.NOTION_CLIENT_ID ?? 'test-notion-client-id';
env.NOTION_CLIENT_SECRET = env.NOTION_CLIENT_SECRET ?? 'test-notion-client-secret';
env.CONFLUENCE_CLIENT_ID = env.CONFLUENCE_CLIENT_ID ?? 'test-confluence-client-id';
env.CONFLUENCE_CLIENT_SECRET = env.CONFLUENCE_CLIENT_SECRET ?? 'test-confluence-client-secret';
env.GOOGLE_CALENDAR_CLIENT_ID = env.GOOGLE_CALENDAR_CLIENT_ID ?? 'test-gcal-client-id';
env.GOOGLE_CALENDAR_CLIENT_SECRET = env.GOOGLE_CALENDAR_CLIENT_SECRET ?? 'test-gcal-client-secret';
env.OUTLOOK_CALENDAR_CLIENT_ID = env.OUTLOOK_CALENDAR_CLIENT_ID ?? 'test-outlook-client-id';
env.OUTLOOK_CALENDAR_CLIENT_SECRET =
  env.OUTLOOK_CALENDAR_CLIENT_SECRET ?? 'test-outlook-client-secret';
env.LINEAR_CLIENT_ID = env.LINEAR_CLIENT_ID ?? 'test-linear-client-id';
env.LINEAR_CLIENT_SECRET = env.LINEAR_CLIENT_SECRET ?? 'test-linear-client-secret';
env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? 'sk-ant-test-placeholder';
env.BANK_ACCOUNT_ENCRYPTION_KEY =
  env.BANK_ACCOUNT_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
env.EMPLOYEE_PII_ENCRYPTION_KEY =
  env.EMPLOYEE_PII_ENCRYPTION_KEY ??
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
env.QSTASH_TOKEN = env.QSTASH_TOKEN ?? 'test-qstash-token';
env.QSTASH_CURRENT_SIGNING_KEY = env.QSTASH_CURRENT_SIGNING_KEY ?? 'sig_test_current';
env.QSTASH_NEXT_SIGNING_KEY = env.QSTASH_NEXT_SIGNING_KEY ?? 'sig_test_next';
env.CRON_SECRET = env.CRON_SECRET ?? 'test-cron-secret-0123456789';
