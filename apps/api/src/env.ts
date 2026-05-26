/**
 * Zod env schema for @contractor-ops/api-server.
 *
 * Loaded once at process boot via `loadEnv()`. Throws on missing required
 * variables so the process refuses to listen with an incomplete config
 * (fail-fast — Render restarts the pod, on-call sees a clear cause in logs).
 *
 * Mirrors the env split documented in plan.md Step 1:
 *   - Server-side vars live here (apps/api/src/env.ts).
 *   - Client-side vars live in apps/web-vite/src/env.ts under `VITE_*`.
 *   - Cron worker vars live in apps/cron-worker/src/env.ts.
 *
 * Optional secrets default to `undefined` so a dev box can boot without
 * every integration credential wired (the corresponding feature degrades
 * gracefully or refuses to register in `server.ts`).
 */

import { z } from 'zod';

// Treat empty strings (common in committed .env files where the key is
// declared but unset, e.g. `R2_ENDPOINT=`) as absent so optional URL/string
// schemas don't reject the value.
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.length === 0 ? undefined : v;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  // Public origins — used to compose CORS allowlist + cookie Domain.
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  // Legacy NEXT_PUBLIC_APP_URL — read by the OAuth start/callback ports
  // to compose error-redirect URLs (Next-era env name preserved so Render
  // env vars don't need a rename). Same value as APP_URL in practice.
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  // Comma-separated CIDR list (or proxy-addr keywords: loopback, linklocal,
  // uniquelocal) trusted for the X-Forwarded-For walk. Mirrors the env knob
  // consumed by the legacy apps/web/src/middleware.ts. Misconfiguring this
  // allows XFF spoofing → rate-limit bypass (F-SEC-17).
  TRUSTED_PROXIES: z.string().default('loopback,linklocal,uniquelocal'),

  // Upstash Redis — required in production for rate-limit (fail-closed).
  // Optional in dev/test; falls back to in-memory LRU per fallbackRateLimit().
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Observability.
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Health/ready probes.
  HEALTH_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // Cloudflare R2 — health probe + presigned uploads. All optional so dev
  // boxes without R2 wired stay green (probe reports `skipped`).
  R2_ACCOUNT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_BUCKET_NAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_BUCKET_NAME_EU: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  R2_FORCE_PATH_STYLE: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .optional()
      .transform(v => v === 'true'),
  ),
  R2_HEALTHCHECK_KEY: z.preprocess(emptyToUndefined, z.string().default('_health/canary.txt')),

  // Upstash QStash — async outbox + cron dispatch. Optional in dev/test.
  QSTASH_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  QSTASH_HEALTH_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default('https://qstash.upstash.io'),
  ),
  // QStash inbound signature verification — both keys required to mount the
  // Receiver; absence fails the request closed with 500 (misconfigured).
  QSTASH_CURRENT_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  QSTASH_NEXT_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // Webhook signing secrets — HMAC verification fail-closes when absent.
  CMS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  STORECOVE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // Microsoft Teams Bot Framework / Azure Bot Service credentials.
  // Empty in dev → `authorizeJWT` enters anonymous mode (non-production only).
  AZURE_BOT_APP_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  AZURE_BOT_APP_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // CSP rollout knob — `report-only` ships violations without blocking,
  // any other value (or unset) means enforce. Mirrors the plan.md Step 2
  // 48h report-only soak before flipping to enforce.
  CSP_MODE: z.preprocess(emptyToUndefined, z.enum(['report-only', 'enforce']).optional()),

  // tRPC body cap (MB). Empty / malformed / non-positive falls back to 1 MB
  // in the plugin. Coerced number lets the schema reject obvious garbage at
  // boot rather than silently disabling the cap (F-SCALE-17).
  TRPC_MAX_BODY_MB: z.preprocess(emptyToUndefined, z.coerce.number().positive().optional()),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment for @contractor-ops/api-server:\n${issues}`);
  }
  cached = parsed.data;

  // Production safety: a missing rate-limit backend in prod is a fail-closed
  // condition (rate-limit plugin will refuse every request). We surface it
  // here so the operator sees the cause at boot, not on the first 503.
  if (cached.NODE_ENV === 'production') {
    if (!(cached.UPSTASH_REDIS_REST_URL && cached.UPSTASH_REDIS_REST_TOKEN)) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are required in production (rate-limit fail-closed posture).',
      );
    }
  }

  return cached;
}

/** Test-only — reset the cached env between unit tests. */
export function __resetEnvForTests(): void {
  cached = undefined;
}
