/**
 * Client-side env contract for @contractor-ops/web-vite.
 *
 * All client-readable variables MUST be prefixed `VITE_*` so Vite inlines
 * them at build time. The Zod schema rejects boots with a missing or
 * malformed value so the static site never ships with a placeholder API
 * URL or DSN.
 *
 * Server-side variables stay in apps/api/src/env.ts and apps/cron-worker/src/env.ts.
 */

import { z } from 'zod';

const envSchema = z.object({
  /** Origin of the Fastify API service. Example: `https://api.contractor-ops.com`. */
  VITE_API_URL: z.string().url(),

  /** Public app origin — used for absolute links in OG tags and email previews. */
  VITE_APP_URL: z.string().url(),

  /** Optional Sentry browser DSN. When unset, Sentry init is a no-op. */
  VITE_SENTRY_DSN: z.string().url().optional(),

  /** Optional PostHog project key for product analytics + Web Vitals. */
  VITE_POSTHOG_KEY: z.string().min(1).optional(),
  VITE_POSTHOG_HOST: z.string().url().optional(),

  /** Cloudflare Turnstile site key for signup bot protection (F-SEC-22). */
  VITE_TURNSTILE_SITE_KEY: z.string().min(1).optional(),

  /** Platform operator org id — client-side admin route gate (see require-platform-operator.ts). */
  VITE_PLATFORM_OPERATOR_ORG_ID: z.string().min(1).optional(),

  /** InPost GeoWidget public token for parcel-locker picker embeds. */
  VITE_INPOST_GEOWIDGET_TOKEN: z.string().min(1).optional(),

  /**
   * Stripe price IDs for the billing UI (plan-comparison-grid + top-up checkout).
   * Vite inlines `VITE_*` at build time; values must be set BEFORE `vite build`
   * runs for each environment. Get them from Stripe dashboard → Products →
   * <plan> → Pricing → API ID. Optional so dev boots without a Stripe account.
   */
  VITE_STRIPE_PRICE_STARTER: z.string().min(1).optional(),
  VITE_STRIPE_PRICE_PRO: z.string().min(1).optional(),
  VITE_STRIPE_PRICE_ENTERPRISE: z.string().min(1).optional(),
  VITE_STRIPE_PRICE_TOPUP_10: z.string().min(1).optional(),
  VITE_STRIPE_PRICE_TOPUP_25: z.string().min(1).optional(),
  VITE_STRIPE_PRICE_TOPUP_50: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof envSchema>;

let cached: ClientEnv | undefined;

export function getClientEnv(): ClientEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid VITE_* environment for @contractor-ops/web-vite:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
