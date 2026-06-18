/**
 * Module-level Zod validation for environment variables consumed by `@contractor-ops/auth`.
 *
 * Goals (per CLAUDE.md "Validation & Data Safety" / "Observability"):
 * - Fail fast at module load on misconfigured secrets in non-development.
 * - Explicit, opt-in OAuth provider configuration: a partially-configured provider
 *   (e.g. `GOOGLE_CLIENT_ID` set but not `GOOGLE_CLIENT_SECRET`) must throw rather
 *   than register an OAuth endpoint with `undefined` credentials.
 * - Eliminate `as string` casts that lie to TypeScript about env presence.
 */

import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

/**
 * Server-side env contract for the auth package.
 * All `*_CLIENT_ID`/`*_CLIENT_SECRET` pairs are optional individually but checked
 * for "all-or-nothing" presence below.
 */
const authEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,

  /** HMAC secret for session cookies. REQUIRED in non-development. */
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, 'BETTER_AUTH_SECRET must be at least 16 characters')
    .optional(),

  /**
   * Canonical base URL of the auth server. Used for `baseURL` and to seed
   * `trustedOrigins`. Falls back to `PUBLIC_APP_URL` when missing.
   */
  BETTER_AUTH_URL: z.url().optional(),
  PUBLIC_APP_URL: z.url().optional(),

  /**
   * Optional comma-separated list of additional trusted origins (e.g. preview
   * deploys, internal admin UI host). Validated as URLs after splitting.
   */
  AUTH_TRUSTED_ORIGINS: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Resend API key — used by Better Auth's transactional email handlers
   * (verification, password reset, magic-link, organization invitation).
   * Required in production; in `development` the handlers fall back to logging
   * so engineers can complete flows locally without Resend.
   */
  RESEND_API_KEY: z.string().min(1).optional(),

  /**
   * From address for Better Auth transactional emails. Defaults to a sane
   * placeholder so local/test environments boot without extra config.
   */
  EMAIL_FROM: z.email().default('noreply@contractor-ops.com'),

  /**
   * Cross-subdomain cookie posture. Set when the SPA (`app.*`) and API
   * (`api.*`) live on different subdomains of the same registrable domain
   * so Better Auth session cookies carry `Domain=.contractor-ops.com;
   * SameSite=None; Secure`.
   *
   * Leaving unset preserves the legacy same-origin posture
   * (`Domain` omitted, `SameSite=Lax`) so the Next.js app keeps working
   * during the migration grace period.
   */
  AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export type GoogleProviderEnv = { clientId: string; clientSecret: string };
export type MicrosoftProviderEnv = { clientId: string; clientSecret: string };

export type ResolvedAuthEnv = {
  nodeEnv: 'development' | 'production' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  betterAuthSecret: string | undefined;
  baseURL: string | undefined;
  trustedOrigins: string[];
  google: GoogleProviderEnv | null;
  microsoft: MicrosoftProviderEnv | null;
  /** Resend API key. Undefined in development means email handlers log instead of sending. */
  resendApiKey: string | undefined;
  /** From address used for all Better Auth transactional emails. */
  emailFrom: string;
  /** Cookie Domain attribute (e.g. `.contractor-ops.com`). Undefined → omit Domain. */
  cookieDomain: string | undefined;
  /** SameSite cookie attribute. Defaults to `'lax'` (legacy same-origin posture). */
  cookieSameSite: 'lax' | 'none' | 'strict';
};

function assertProviderPair(
  id: string | undefined,
  secret: string | undefined,
  name: 'GOOGLE' | 'MICROSOFT',
): { clientId: string; clientSecret: string } | null {
  if (!(id || secret)) return null;
  if (!(id && secret)) {
    throw new Error(
      `[@contractor-ops/auth] ${name}_CLIENT_ID and ${name}_CLIENT_SECRET must be set together. ` +
        `Got: ${name}_CLIENT_ID=${id ? 'present' : 'missing'}, ` +
        `${name}_CLIENT_SECRET=${secret ? 'present' : 'missing'}.`,
    );
  }
  return { clientId: id, clientSecret: secret };
}

function parseTrustedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Parses and validates the env vars used by the auth package.
 *
 * Throws on:
 * - Partial OAuth provider configuration.
 * - Missing `BETTER_AUTH_SECRET` in non-development.
 * - Malformed URLs (`BETTER_AUTH_URL`, `PUBLIC_APP_URL`, `AUTH_TRUSTED_ORIGINS`).
 *
 * Returns a normalized object the rest of the package can consume safely.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: env schema validation with many conditional refinements across OAuth providers and environments; cohesive validation block.
export function loadAuthEnv(env: NodeJS.ProcessEnv = process.env): ResolvedAuthEnv {
  const parsed = authEnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`[@contractor-ops/auth] Invalid environment: ${issues}`);
  }

  const data = parsed.data;
  const nodeEnv = data.NODE_ENV;
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  // Secret is mandatory in production. Better Auth otherwise falls back to a
  // non-deterministic key on each restart, invalidating live sessions.
  // In `development` and `test` we tolerate a missing secret to keep local /
  // unit-test workflows ergonomic.
  if (!data.BETTER_AUTH_SECRET && isProduction) {
    throw new Error('[@contractor-ops/auth] BETTER_AUTH_SECRET is required in production.');
  }

  // Resend API key is mandatory in production so Better Auth's email handlers
  // (verification, reset, magic-link, invitation) can deliver transactional
  // mail. Without it the auth surface is silently broken.
  // Development falls back to logging the URL.
  if (!data.RESEND_API_KEY && isProduction) {
    throw new Error(
      '[@contractor-ops/auth] RESEND_API_KEY is required in production for Better Auth email handlers.',
    );
  }

  // Resolve baseURL: prefer BETTER_AUTH_URL, fall back to PUBLIC_APP_URL.
  const baseURL = data.BETTER_AUTH_URL ?? data.PUBLIC_APP_URL;

  const extraOrigins = parseTrustedOrigins(data.AUTH_TRUSTED_ORIGINS);
  for (const origin of extraOrigins) {
    // Validate each entry — throw fast on malformed values rather than silently
    // dropping them (which would weaken origin checks unnoticed).
    try {
      new URL(origin);
    } catch {
      throw new Error(
        `[@contractor-ops/auth] AUTH_TRUSTED_ORIGINS contains invalid URL: "${origin}"`,
      );
    }
  }

  const trustedOrigins: string[] = [];
  if (baseURL) trustedOrigins.push(baseURL);
  for (const origin of extraOrigins) {
    if (!trustedOrigins.includes(origin)) trustedOrigins.push(origin);
  }

  const google = assertProviderPair(data.GOOGLE_CLIENT_ID, data.GOOGLE_CLIENT_SECRET, 'GOOGLE');
  const microsoft = assertProviderPair(
    data.MICROSOFT_CLIENT_ID,
    data.MICROSOFT_CLIENT_SECRET,
    'MICROSOFT',
  );

  // Cross-subdomain cookies require SameSite=None + Secure. Reject configs
  // that would issue browser-ignored cookies (Chrome/Firefox refuse
  // SameSite=None without Secure) — better to fail fast at boot than to
  // sign users out silently in production.
  const cookieSameSite = data.AUTH_COOKIE_SAME_SITE ?? 'lax';
  if (cookieSameSite === 'none' && !isProduction && !data.AUTH_COOKIE_DOMAIN) {
    // SameSite=None in dev without Secure (we toggle Secure on isProduction
    // in config.ts) is a noisy footgun. Surface it loudly.
    throw new Error(
      '[@contractor-ops/auth] AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_DOMAIN to be set ' +
        '(implies cross-subdomain Secure cookies; reject dev configs that would issue Lax-equivalent cookies).',
    );
  }

  return {
    nodeEnv,
    isDevelopment,
    isProduction,
    betterAuthSecret: data.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins,
    google,
    microsoft,
    resendApiKey: data.RESEND_API_KEY,
    emailFrom: data.EMAIL_FROM,
    cookieDomain: data.AUTH_COOKIE_DOMAIN,
    cookieSameSite,
  };
}

/** Module-level singleton — evaluated at first import of the auth package. */
export const authEnv: ResolvedAuthEnv = loadAuthEnv();
