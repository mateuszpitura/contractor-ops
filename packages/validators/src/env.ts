import { z } from 'zod';

const hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'Must be a 32-byte hex string (64 hex characters)');

const optionalUrl = z.url().optional();

// ── Core ────────────────────────────────────────────────────────────────────

const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Public origin of the SPA / Next landing host — browser-visible URLs. */
  PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  /** OAuth redirect host (DocuSign, Linear, Jira) — separate from APP/API in prod. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** Fastify API host (apps/api). QStash + external-provider webhook targets. */
  API_URL: z.url().default('http://localhost:4000'),
});

// ── Database ────────────────────────────────────────────────────────────────

const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_EU: z.string().min(1, 'DATABASE_URL_EU is required'),
  DATABASE_URL_ME: z.string().min(1, 'DATABASE_URL_ME is required'),
  // F-SCALE-06 — optional per-region read-replica URLs. When set, the read
  // replica is used by call sites that opt into `readReplica(region, fn)`
  // (e.g. `dashboard.kpis`); otherwise reads go to the writer transparently.
  // Leaving these unset is the default for local dev — production should set
  // them once per region's Neon read-replica is provisioned.
  DATABASE_URL_EU_RO: z.string().min(1).optional(),
  DATABASE_URL_ME_RO: z.string().min(1).optional(),
});

// ── Auth ────────────────────────────────────────────────────────────────────

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(16, 'Auth secret must be at least 16 characters'),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  MICROSOFT_CLIENT_ID: z.string().min(1, 'MICROSOFT_CLIENT_ID is required'),
  MICROSOFT_CLIENT_SECRET: z.string().min(1, 'MICROSOFT_CLIENT_SECRET is required'),
});

// ── Stripe ──────────────────────────────────────────────────────────────────

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Must start with whsec_'),
  STRIPE_PRICE_STARTER: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_PRO: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_TOPUP_10: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_TOPUP_25: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_TOPUP_50: z.string().startsWith('price_', 'Must be a valid Stripe price ID'),
});

// ── Email (Resend) ──────────────────────────────────────────────────────────

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_WEBHOOK_SECRET: z.string().min(1, 'RESEND_WEBHOOK_SECRET is required'),
  EMAIL_FROM: z.email().default('noreply@contractor-ops.com'),
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
  // Optional S3-compatible endpoint override. Unset → Cloudflare R2
  // (`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`). Set this to point
  // at a local MinIO instance (e.g. `http://localhost:9000`) for offline dev.
  R2_ENDPOINT: optionalUrl,
  // Force path-style addressing. R2 uses virtual-hosted-style by default;
  // MinIO defaults to path-style. Set to `true` when R2_ENDPOINT points at
  // MinIO.
  R2_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform(v => v === 'true'),
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

// ── Cloudflare Turnstile (signup bot protection — F-SEC-22) ────────────────
// Optional in development so contributors don't need a Cloudflare app to run
// the app locally; the signup `before` hook short-circuits the verification
// when both vars are unset (and logs a Sentry warning if NODE_ENV=production).

const turnstileSchema = z.object({
  /** Server-side verification secret. NEVER expose. SPA reads VITE_TURNSTILE_SITE_KEY. */
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

// ── Trusted reverse proxy CIDRs (F-SEC-17) ─────────────────────────────────
// Comma-separated list of CIDR ranges or proxy-addr keywords (loopback,
// linklocal, uniquelocal). Used by `proxy-addr` to walk the X-Forwarded-For
// chain right-to-left, terminating at the first untrusted hop. Document the
// production value (Render's CIDR or "loopback,linklocal,uniquelocal") in
// .env.example. Misconfiguration enables IP spoofing for rate-limit bypass.
const proxySchema = z.object({
  TRUSTED_PROXIES: z.string().optional(),
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

// ── Platform Operator ──────────────────────────────────────────────────────
// Dedicated organization id whose members hold the `platform_operator` role.
// Used to gate access to `/admin/*` cross-tenant operator surfaces (e.g. BoE
// base-rate management, classification-engine flag overview). Optional in
// development; production deployments MUST set this so the admin shell rejects
// arbitrary org owners (F-SEC-04).
const platformOperatorSchema = z.object({
  // Org IDs in this schema are generated with Prisma `@default(cuid())`, not
  // UUID. Accept any non-empty string (CUID, UUID, or other) so the gate works
  // regardless of the ID strategy. Strict format checks belong at row-creation
  // time in Prisma, not on env vars.
  PLATFORM_OPERATOR_ORG_ID: z.string().min(1).optional(),
});

// ── Observability ──────────────────────────────────────────────────────────

const observabilitySchema = z.object({
  SENTRY_DSN: z.url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().default('contractor-ops'),
  // Dev-only — when set, the root Pino logger fans out a second stream
  // that pushes to `${LOKI_URL}/loki/api/v1/push`. Prod leaves it unset
  // so the Axiom shipper remains the canonical sink.
  LOKI_URL: z.url().optional(),
  LOKI_SERVICE_LABEL: z.string().optional(),
  // Dev override — when SENTRY_DSN points at a local GlitchTip instance,
  // SENTRY_DEV=true defeats the dev hard-disable in the app Sentry inits
  // so events flow into the local project instead of being dropped.
  SENTRY_DEV: z.union([z.literal('true'), z.literal('false')]).optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
});

// ── Optional infrastructure (graceful degradation when unset) ───────────────

const infrastructureSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  CRONITOR_API_KEY: z.string().optional(),
  AZURE_BOT_APP_ID: z.string().optional(),
  AZURE_BOT_APP_SECRET: z.string().optional(),
  /** Primary data region for generated legal PDFs and similar (EU | ME). */
  DATA_HOSTING_REGION: z.enum(['EU', 'ME']).default('EU'),
  /** Slack bot token encryption (AES-256-GCM); required when Slack is used. */
  SLACK_TOKEN_ENCRYPTION_KEY: hex32.optional(),
});

// ── Feature Flags (Unleash OSS, per region) ─────────────────────────────────
// Optional at all times: when unset, the feature-flag package falls back to
// stub clients and code-declared defaults (graceful degradation). Set in
// production for real flag evaluation.

const featureFlagsSchema = z.object({
  UNLEASH_URL_EU: z.url().optional(),
  UNLEASH_API_TOKEN_EU: z.string().optional(),
  UNLEASH_URL_ME: z.url().optional(),
  UNLEASH_API_TOKEN_ME: z.string().optional(),
  UNLEASH_APP_NAME: z.string().default('contractor-ops'),
  UNLEASH_ENVIRONMENT: z.string().default('development'),
});

// ── OAuth env names used by specific adapters only (optional when unused) ──
// e.g. Google Workspace Directory import, Outlook Calendar (Microsoft identity vars).

const oauthAliasSchema = z.object({
  GOOGLE_WORKSPACE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_WORKSPACE_CLIENT_SECRET: z.string().min(1).optional(),
  OUTLOOK_CLIENT_ID: z.string().min(1).optional(),
  OUTLOOK_CLIENT_SECRET: z.string().min(1).optional(),
});

// ── Infisical (external secret store) ───────────────────────────────────────
// Optional everywhere: when client id / secret / project id are all present the
// secret-store factory in consuming packages wires a real Infisical-backed
// store; otherwise it falls back to the in-memory dev/test default. Leaving
// these unset is the supported local-dev posture.

const infisicalSchema = z.object({
  INFISICAL_CLIENT_ID: z.string().min(1).optional(),
  INFISICAL_CLIENT_SECRET: z.string().min(1).optional(),
  INFISICAL_PROJECT_ID: z.string().min(1).optional(),
  INFISICAL_SITE_URL: optionalUrl,
  INFISICAL_ENVIRONMENT: z.string().min(1).optional(),
});

// ── PostHog (server-side product analytics) ─────────────────────────────────
//
// The `posthog-node` client fires identified events (signup_completed,
// first_contractor_added, paid_converted, …) from server-side hooks. Keys
// are optional because dev / preview builds run without analytics; in
// production the boot-time `getServerEnv()` read in `apps/api/src/index.ts`
// asserts the key is present.

const posthogServerSchema = z.object({
  POSTHOG_API_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.url().default('https://eu.i.posthog.com'),
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
  .merge(platformOperatorSchema)
  .merge(observabilitySchema)
  .merge(oauthAliasSchema)
  .merge(infrastructureSchema)
  .merge(featureFlagsSchema)
  .merge(turnstileSchema)
  .merge(proxySchema)
  .merge(infisicalSchema)
  .merge(posthogServerSchema);

// ── Client env (NEXT_PUBLIC_ only) ──────────────────────────────────────────

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
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
// Empty string in dotenv means "key declared but blank" (e.g. `TURNSTILE_SITE_KEY=`).
// Treat it the same as a missing key so `.optional()` schemas accept blank lines from .env.
function coerceBlankToUndefined(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = v === '' ? undefined : v;
  }
  return out;
}

export function validateServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(coerceBlankToUndefined(env));
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
  const result = clientEnvSchema.safeParse(coerceBlankToUndefined(env));
  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Client environment validation failed:\n${errors}`);
  }
  return result.data;
}
