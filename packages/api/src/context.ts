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

export type Context = Awaited<ReturnType<typeof createContext>>;
