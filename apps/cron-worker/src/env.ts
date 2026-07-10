/**
 * Zod env schema for @contractor-ops/cron-worker.
 *
 * Symmetric to apps/api/src/env.ts — same fail-fast posture, but a
 * smaller surface (no CORS / rate-limit knobs; the worker exposes a
 * single /health endpoint to satisfy Render's liveness probe).
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().optional(),

  /**
   * Base URL of the Fastify API host. Used by the late-interest PDF reaper to
   * re-publish render jobs to QStash; falls back to PUBLIC_APP_URL until
   * Step 16 cutover.
   */
  API_URL: z.string().url().optional(),

  /**
   * Public app URL used to build links in cron-dispatched emails and as the
   * legacy QStash destination prior to the Fastify cutover.
   */
  PUBLIC_APP_URL: z.string().url().optional(),

  /**
   * Port for the internal health endpoint. Kept off the public network.
   * Default 4101 to avoid collision with apps/public-api (PUBLIC_API_PORT
   * default 4100) when both run side-by-side under `pnpm dev`.
   */
  CRON_HEALTH_PORT: z.coerce.number().int().positive().default(4101),
  CRON_HEALTH_HOST: z.string().default('0.0.0.0'),

  /**
   * Cron schedule overrides — useful in tests and staging where the
   * default 15-min / daily cadence would either run too rarely (manual
   * verification) or too often (load). Defaults match the legacy Render
   * cron services they replace.
   */
  CRON_TOKEN_REFRESH_SCHEDULE: z.string().default('*/15 * * * *'),
  CRON_DATA_PURGE_SCHEDULE: z.string().default('0 3 * * *'),
  CRON_EXCHANGE_RATES_SCHEDULE: z.string().default('0 6 * * *'),
  CRON_BOE_RATE_POLL_SCHEDULE: z.string().default('0 6 * * *'),
  CRON_ORG_DEFINITION_SYNC_SCHEDULE: z.string().default('0 4 * * *'),
  CRON_HRIS_SYNC_SCHEDULE: z.string().default('0 * * * *'),
  CRON_CLASSIFICATION_REASSESSMENT_TRIGGERS_SCHEDULE: z.string().default('0 3 * * *'),
  CRON_CLASSIFICATION_ECONOMIC_DEPENDENCY_SCHEDULE: z.string().default('0 2 * * *'),
  CRON_CONTRACT_EXPIRY_SCAN_SCHEDULE: z.string().default('0 4 * * *'),
  CRON_FORM_1099K_TRACKER_SCHEDULE: z.string().default('0 5 * * *'),
  CRON_INPOST_STATUS_POLL_SCHEDULE: z.string().default('0 * * * *'),
  CRON_JOB_HEALTH_SCHEDULE: z.string().default('*/5 * * * *'),
  CRON_API_KEY_LEAK_ALARM_SCHEDULE: z.string().default('0 * * * *'),
  CRON_LATE_INTEREST_PDF_REAPER_SCHEDULE: z.string().default('*/5 * * * *'),
  CRON_DOCUMENT_VIRUS_SCAN_RECONCILE_SCHEDULE: z.string().default('*/5 * * * *'),
  CRON_TRIAL_NOTIFICATIONS_SCHEDULE: z.string().default('0 9 * * *'),
  CRON_REMINDERS_SCHEDULE: z.string().default('0 9 * * *'),
  // Year-end 1099-NEC batch-due reminder — mid-January (before the ~Jan 31
  // furnish deadline). Notify-only; never generates or files.
  CRON_YEAR_END_1099_REMINDER_SCHEDULE: z.string().default('0 8 15 1 *'),
  CRON_STRIPE_RECONCILE_SCHEDULE: z.string().default('0 1 * * *'),
  CRON_ZATCA_RECONCILE_SCHEDULE: z.string().default('*/15 * * * *'),
  CRON_PEPPOL_RECONCILE_SCHEDULE: z.string().default('*/15 * * * *'),

  /**
   * Age (minutes) after which a still-PENDING ZATCA chain is resubmitted by the
   * reconcile cron. Slightly above the QStash retry horizon so the cron only
   * touches submissions those retries have already given up on.
   */
  CRON_ZATCA_RECONCILE_STALE_MINUTES: z.coerce.number().int().positive().default(15),

  /**
   * Default per-run wall-clock budget (ms) for a cron tick. The runner races
   * each handler against this; on breach it abandons the handler and pages
   * Sentry. Individual jobs can override it in the registry's static meta.
   * Default 5 min.
   */
  CRON_JOB_DEFAULT_MAX_MS: z.coerce.number().int().positive().default(300_000),

  /** Observability. */
  SENTRY_DSN: z.string().url().optional(),
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
    throw new Error(`Invalid environment for @contractor-ops/cron-worker:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function __resetEnvForTests(): void {
  cached = undefined;
}
