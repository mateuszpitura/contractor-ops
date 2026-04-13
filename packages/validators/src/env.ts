import { z } from 'zod';

const hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'Must be a 32-byte hex string (64 hex characters)');

const optionalUrl = z.string().url().optional();

// ── Core ────────────────────────────────────────────────────────────────────

const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

// ── Database ────────────────────────────────────────────────────────────────

const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_EU: z.string().min(1, 'DATABASE_URL_EU is required'),
  DATABASE_URL_ME: z.string().min(1, 'DATABASE_URL_ME is required'),
});

// ── Auth ────────────────────────────────────────────────────────────────────

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(16, 'Auth secret must be at least 16 characters'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  MICROSOFT_CLIENT_ID: z.string().min(1, 'MICROSOFT_CLIENT_ID is required'),
  MICROSOFT_CLIENT_SECRET: z.string().min(1, 'MICROSOFT_CLIENT_SECRET is required'),
});

// ── Stripe ──────────────────────────────────────────────────────────────────

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Must start with whsec_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'Must start with pk_'),
  STRIPE_PRICE_STARTER: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_PRO: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_10: z
    .string()
    .startsWith('price_', 'Must be a valid Stripe price ID'),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_25: z
    .string()
    .startsWith('price_', 'Must be a valid Stripe price ID'),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50: z
    .string()
    .startsWith('price_', 'Must be a valid Stripe price ID'),
});

// ── Email (Resend) ──────────────────────────────────────────────────────────

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_WEBHOOK_SECRET: z.string().min(1, 'RESEND_WEBHOOK_SECRET is required'),
  EMAIL_FROM: z.string().email().default('noreply@contractor-ops.com'),
});

/** Optional dev-only SMTP (e.g. Mailpit). Used by app email when NODE_ENV=development and host is set. */
const devMailSchema = z.object({
  DEV_SMTP_HOST: z.string().optional(),
  DEV_SMTP_PORT: z.coerce.number().int().positive().default(1025),
});

// ── Cloudflare R2 ───────────────────────────────────────────────────────────

const r2Schema = z.object({
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().optional(),
  R2_BUCKET_NAME_EU: z.string().default('contractor-ops-documents-eu'),
  R2_BUCKET_NAME_ME: z.string().default('contractor-ops-documents-me'),
  R2_PUBLIC_URL: optionalUrl,
});

// ── ClamAV ──────────────────────────────────────────────────────────────────

const clamavSchema = z.object({
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
});

// ── Slack ────────────────────────────────────────────────────────────────────

const slackSchema = z.object({
  SLACK_CLIENT_ID: z.string().min(1, 'SLACK_CLIENT_ID is required'),
  SLACK_CLIENT_SECRET: z.string().min(1, 'SLACK_CLIENT_SECRET is required'),
  SLACK_SIGNING_SECRET: z.string().min(1, 'SLACK_SIGNING_SECRET is required'),
  SLACK_REDIRECT_URI: optionalUrl,
});

// ── Jira ────────────────────────────────────────────────────────────────────

const jiraSchema = z.object({
  JIRA_CLIENT_ID: z.string().min(1, 'JIRA_CLIENT_ID is required'),
  JIRA_CLIENT_SECRET: z.string().min(1, 'JIRA_CLIENT_SECRET is required'),
});

// ── DocuSign ────────────────────────────────────────────────────────────────

const docusignSchema = z.object({
  DOCUSIGN_CLIENT_ID: z.string().min(1, 'DOCUSIGN_CLIENT_ID is required'),
  DOCUSIGN_CLIENT_SECRET: z.string().min(1, 'DOCUSIGN_CLIENT_SECRET is required'),
  DOCUSIGN_WEBHOOK_SECRET: z.string().optional(),
});

// ── Autenti ─────────────────────────────────────────────────────────────────

const autentiSchema = z.object({
  AUTENTI_CLIENT_ID: z.string().min(1, 'AUTENTI_CLIENT_ID is required'),
  AUTENTI_CLIENT_SECRET: z.string().min(1, 'AUTENTI_CLIENT_SECRET is required'),
  AUTENTI_WEBHOOK_SECRET: z.string().optional(),
});

// ── Notion ──────────────────────────────────────────────────────────────────

const notionSchema = z.object({
  NOTION_CLIENT_ID: z.string().min(1, 'NOTION_CLIENT_ID is required'),
  NOTION_CLIENT_SECRET: z.string().min(1, 'NOTION_CLIENT_SECRET is required'),
});

// ── Confluence ──────────────────────────────────────────────────────────────

const confluenceSchema = z.object({
  CONFLUENCE_CLIENT_ID: z.string().min(1, 'CONFLUENCE_CLIENT_ID is required'),
  CONFLUENCE_CLIENT_SECRET: z.string().min(1, 'CONFLUENCE_CLIENT_SECRET is required'),
});

// ── Google Calendar ─────────────────────────────────────────────────────────

const googleCalendarSchema = z.object({
  GOOGLE_CALENDAR_CLIENT_ID: z.string().min(1, 'GOOGLE_CALENDAR_CLIENT_ID is required'),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CALENDAR_CLIENT_SECRET is required'),
});

// ── Outlook Calendar ────────────────────────────────────────────────────────

const outlookCalendarSchema = z.object({
  OUTLOOK_CALENDAR_CLIENT_ID: z.string().min(1, 'OUTLOOK_CALENDAR_CLIENT_ID is required'),
  OUTLOOK_CALENDAR_CLIENT_SECRET: z.string().min(1, 'OUTLOOK_CALENDAR_CLIENT_SECRET is required'),
});

// ── Linear ──────────────────────────────────────────────────────────────────

const linearSchema = z.object({
  LINEAR_CLIENT_ID: z.string().min(1, 'LINEAR_CLIENT_ID is required'),
  LINEAR_CLIENT_SECRET: z.string().min(1, 'LINEAR_CLIENT_SECRET is required'),
  LINEAR_WEBHOOK_SECRET: z.string().optional(),
});

// ── Bank Account Encryption ─────────────────────────────────────────────────

const bankEncryptionSchema = z.object({
  BANK_ACCOUNT_ENCRYPTION_KEY: hex32,
});

// ── OCR (Claude Vision) ────────────────────────────────────────────────────

const ocrSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
});

// ── QStash ──────────────────────────────────────────────────────────────────

const qstashSchema = z.object({
  QSTASH_TOKEN: z.string().min(1, 'QSTASH_TOKEN is required'),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1, 'QSTASH_CURRENT_SIGNING_KEY is required'),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1, 'QSTASH_NEXT_SIGNING_KEY is required'),
});

// ── Cron ────────────────────────────────────────────────────────────────────

const cronSchema = z.object({
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
});

// ── Portal ──────────────────────────────────────────────────────────────────

const portalSchema = z.object({
  PORTAL_BASE_DOMAIN: z.string().default('portal.localhost:3000'),
});

// ── Observability ──────────────────────────────────────────────────────────

const observabilitySchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().default('contractor-ops'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
});

// ── Optional infrastructure (graceful degradation when unset) ───────────────

const infrastructureSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  CRONITOR_API_KEY: z.string().optional(),
  AZURE_BOT_APP_ID: z.string().optional(),
  AZURE_BOT_APP_SECRET: z.string().optional(),
  /** Primary data region for generated legal PDFs and similar (EU | ME). */
  DATA_HOSTING_REGION: z.enum(['EU', 'ME']).default('EU'),
  /** Slack bot token encryption (AES-256-GCM); required when Slack is used. */
  SLACK_TOKEN_ENCRYPTION_KEY: hex32.optional(),
});

// ── OAuth env names used by specific adapters only (optional when unused) ──
// e.g. Google Workspace Directory import, Outlook Calendar (Microsoft identity vars).

const oauthAliasSchema = z.object({
  GOOGLE_WORKSPACE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_WORKSPACE_CLIENT_SECRET: z.string().min(1).optional(),
  OUTLOOK_CLIENT_ID: z.string().min(1).optional(),
  OUTLOOK_CLIENT_SECRET: z.string().min(1).optional(),
});

// ── Full server env (all variables) ─────────────────────────────────────────

export const serverEnvSchema = coreSchema
  .merge(databaseSchema)
  .merge(authSchema)
  .merge(stripeSchema)
  .merge(emailSchema)
  .merge(devMailSchema)
  .merge(r2Schema)
  .merge(clamavSchema)
  .merge(slackSchema)
  .merge(jiraSchema)
  .merge(docusignSchema)
  .merge(autentiSchema)
  .merge(notionSchema)
  .merge(confluenceSchema)
  .merge(googleCalendarSchema)
  .merge(outlookCalendarSchema)
  .merge(linearSchema)
  .merge(bankEncryptionSchema)
  .merge(ocrSchema)
  .merge(qstashSchema)
  .merge(cronSchema)
  .merge(portalSchema)
  .merge(observabilitySchema)
  .merge(oauthAliasSchema)
  .merge(infrastructureSchema);

// ── Client env (NEXT_PUBLIC_ only) ──────────────────────────────────────────

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_10: z.string().startsWith('price_').optional(),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_25: z.string().startsWith('price_').optional(),
  NEXT_PUBLIC_STRIPE_PRICE_TOPUP_50: z.string().startsWith('price_').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let serverEnvCache: ServerEnv | undefined;

/**
 * Parsed, type-safe server environment (Zod-validated). Lazily reads `process.env`
 * on first access and caches the result for the process lifetime.
 *
 * Prefer this over raw `process.env` in application code so values match
 * `serverEnvSchema` and TypeScript types are accurate without non-null assertions.
 *
 * Call from `instrumentation` (or another startup hook) to fail fast on boot, or rely
 * on the first call site to validate.
 */
export function getServerEnv(): ServerEnv {
  if (serverEnvCache === undefined) {
    validateServerEnv();
  }
  if (serverEnvCache === undefined) {
    throw new Error('getServerEnv: cache not populated after validateServerEnv');
  }
  return serverEnvCache;
}

/**
 * Validated env as a string map for dynamic lookups (e.g. OAuth `clientIdEnvVar` from adapters).
 */
export function getServerEnvRecord(): Record<string, string | undefined> {
  return getServerEnv() as unknown as Record<string, string | undefined>;
}

/**
 * Clears the cached result of {@link getServerEnv}. Intended for unit tests that
 * mutate `process.env` between cases.
 */
export function resetServerEnvCacheForTesting(): void {
  serverEnvCache = undefined;
}

/**
 * Validate server environment variables. Call once at app startup.
 * Throws a descriptive error listing all missing/invalid variables.
 *
 * For ad-hoc parsing (e.g. tests with a custom env object), use {@link serverEnvSchema.safeParse}
 * or pass a record here — this does not update the {@link getServerEnv} cache unless
 * validating the default `process.env`.
 */
export function validateServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  if (env === process.env) {
    serverEnvCache = result.data;
  }
  return result.data;
}

/**
 * Validate client environment variables (NEXT_PUBLIC_ only).
 */
export function validateClientEnv(
  env: Record<string, string | undefined> = process.env,
): ClientEnv {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Client environment validation failed:\n${errors}`);
  }
  return result.data;
}
