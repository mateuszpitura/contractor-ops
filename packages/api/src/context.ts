/**
 * tRPC context created from incoming request headers.
 * The headers are used by Better Auth to validate sessions.
 *
 * Extended with optional API key auth fields so the same context type
 * serves both session-based (web app) and API-key-based (public REST API) flows.
 */

import type { Session } from '@contractor-ops/auth';
import { authApi } from '@contractor-ops/auth';

export type AuthMode = 'session' | 'apiKey' | 'cron' | 'portal';

export type ApiContext = {
  headers: Headers;
  session: Session | null;
  user: Session['user'] | null;
  /** Discriminator for which auth mechanism validated this request. */
  authMode?: AuthMode;
  /** ID of the API key used (only set when authMode === 'apiKey'). */
  apiKeyId?: string;
  /** Scopes granted to the API key (only set when authMode === 'apiKey'). */
  apiKeyScopes?: string[];
  /**
   * Attribution actor bound to the API key — a real, active org member whose id
   * fills non-null user FKs on API-key writes. Attribution ONLY, never an
   * authorization source (scopes are). Set when authMode === 'apiKey'.
   */
  apiKeyActingUserId?: string;
  /** Client source IP captured at the HTTP boundary (public API), for audit. */
  sourceIp?: string;
  /** Client User-Agent captured at the HTTP boundary (public API), for audit. */
  userAgent?: string;
};

export async function createContext(opts: { headers: Headers }): Promise<ApiContext> {
  const session = await authApi.getSession({ headers: opts.headers });

  return {
    headers: opts.headers,
    session: session ?? null,
    user: session?.user ?? null,
  };
}

/**
 * Creates a minimal context for API key authentication.
 * Session resolution is skipped — the API key middleware handles auth.
 */
export function createApiKeyContext(opts: { headers: Headers }): ApiContext {
  return {
    headers: opts.headers,
    session: null,
    user: null,
    authMode: 'apiKey',
  };
}

/**
 * Creates a minimal context for cron-triggered tRPC calls.
 * Session resolution is skipped — `cronProcedure` middleware authenticates
 * via the `Authorization: Bearer <CRON_SECRET>` header on `ctx.headers`.
 * The caller is responsible for constructing those headers with a valid
 * secret from `getServerEnv().CRON_SECRET`.
 */
export function createCronContext(opts: { headers: Headers }): ApiContext {
  return {
    headers: opts.headers,
    session: null,
    user: null,
    authMode: 'cron',
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
