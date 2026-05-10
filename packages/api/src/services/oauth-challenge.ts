/**
 * F-SEC-05 + F-SEC-21 — OAuth challenge: single-use, browser-bound CSRF guard.
 *
 * Layered ON TOP of the existing HMAC-signed `state` from
 * `packages/integrations/src/services/oauth-state.ts`. The HMAC continues to
 * encode `(provider, orgId, userId, ts)` and acts as the value sent to the
 * IdP. We additionally:
 *   1. Persist an `OAuthChallenge` row keyed on `hmac(state)` at flow start
 *      (HMAC keyed off `BETTER_AUTH_SECRET` — see {@link hashOAuthState}).
 *   2. Set a `__Host-oauth_state` cookie holding the same `state` value
 *      (httpOnly, secure, sameSite=lax, Path=/api/oauth, Max-Age=10m).
 *   3. On callback, hash the cookie value, atomically flip `consumedAt` via
 *      `updateMany({ where: { stateHash, consumedAt: null, expiresAt:gt:now }, data: { consumedAt: now } })`.
 *      Result count must equal 1 — anything else means missing, expired,
 *      replayed, or attacker-supplied state.
 *
 * Closes:
 *   - F-SEC-05 (OAuth callback CSRF — state binds to attacker, victim's code
 *     gets associated with attacker's org). The cookie binding ensures the
 *     callback can only land in the browser that initiated the flow.
 *   - F-SEC-21 (state replay within 10-min window). Atomic `updateMany`
 *     guarantees single-use semantics even under concurrent callback delivery.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';

/** 10-minute challenge expiry — matches the HMAC state freshness tolerance. */
const OAUTH_CHALLENGE_EXPIRY_MS = 10 * 60 * 1000;

/** Cookie name used for browser-binding. `__Host-` prefix locks the cookie to
 *  the exact host + Path=/ + Secure + no Domain attribute, preventing
 *  subdomain shadowing from escaping the binding. */
export const OAUTH_STATE_COOKIE_NAME = '__Host-oauth_state';

/** Cookie Max-Age in seconds. */
export const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Domain-separator label for the HMAC keying material — bumped versions
 * invalidate every in-flight challenge, which is acceptable here because
 * OAuth challenges expire after 10 minutes anyway.
 */
const OAUTH_STATE_HMAC_LABEL = 'oauth-state-v1';

/**
 * Hash the user-facing `state` value for use as the row's primary lookup key.
 *
 * We never persist the raw state itself — only its HMAC digest — so a leaked
 * DB snapshot does not enable replay against the live IdP. Using HMAC keyed
 * off `BETTER_AUTH_SECRET` (rather than plain SHA-256) ensures a read-only
 * disclosure of the `OAuthChallenge` table cannot be correlated against
 * candidate state values offline without also leaking the app secret.
 *
 * Mirrors the `signPortalSessionToken` pattern in
 * `packages/api/src/routers/portal/portal.ts` — both derive a per-purpose key
 * by appending a `|<label>-vN` domain separator to the shared secret.
 */
export function hashOAuthState(state: string): string {
  const secret = getServerEnv().BETTER_AUTH_SECRET;
  return createHmac('sha256', `${secret}|${OAUTH_STATE_HMAC_LABEL}`).update(state).digest('hex');
}

interface OAuthChallengeRow {
  id: string;
  provider: string;
  organizationId: string | null;
  userId: string;
  stateHash: string;
  pkceVerifier: string | null;
  redirectUri: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

interface OAuthChallengeDelegate {
  create: (args: { data: Record<string, unknown> }) => Promise<OAuthChallengeRow>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  findFirst: (args: { where: { stateHash: string } }) => Promise<OAuthChallengeRow | null>;
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
}

export type OAuthChallengeDb = {
  oAuthChallenge: OAuthChallengeDelegate;
};

function delegate(db: unknown): OAuthChallengeDelegate {
  return (db as { oAuthChallenge: OAuthChallengeDelegate }).oAuthChallenge;
}

export interface CreateOAuthChallengeInput {
  /** Prisma client (typically the global, since OAuth flows pre-date tenant resolution). */
  db: unknown;
  /** The HMAC-signed state value being sent to the IdP. */
  state: string;
  provider: string;
  /** May be null for pre-org-select flows; not used today but the schema allows it. */
  organizationId: string | null;
  userId: string;
  redirectUri: string;
  pkceVerifier?: string | null;
}

export interface CreateOAuthChallengeResult {
  /** Cookie value to set as `__Host-oauth_state` — same as the IdP `state` param. */
  cookieValue: string;
  /** Cookie `Max-Age` (seconds). */
  maxAgeSeconds: number;
  /** Server-stored hash of state for forensics / debugging. */
  stateHash: string;
}

/**
 * Persist an OAuthChallenge row at the start of an OAuth flow. Returns the
 * value the caller must set on the `__Host-oauth_state` cookie (it is the
 * same `state` value sent to the IdP — the cookie binds the callback to the
 * browser that initiated the flow).
 */
export async function createOAuthChallenge(
  input: CreateOAuthChallengeInput,
): Promise<CreateOAuthChallengeResult> {
  const stateHash = hashOAuthState(input.state);
  const expiresAt = new Date(Date.now() + OAUTH_CHALLENGE_EXPIRY_MS);

  await delegate(input.db).create({
    data: {
      id: randomUUID(),
      provider: input.provider,
      organizationId: input.organizationId,
      userId: input.userId,
      stateHash,
      pkceVerifier: input.pkceVerifier ?? null,
      redirectUri: input.redirectUri,
      expiresAt,
    },
  });

  return {
    cookieValue: input.state,
    maxAgeSeconds: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
    stateHash,
  };
}

export interface ConsumeOAuthChallengeInput {
  db: unknown;
  /** The state echoed back by the IdP (must equal the cookie value). */
  callbackState: string;
  /** The cookie value the browser sent — must hash to the same row. */
  cookieState: string | null | undefined;
  /** Provider in the callback URL; rejected if it does not match the row. */
  expectedProvider: string;
}

export interface ConsumedOAuthChallenge {
  organizationId: string | null;
  userId: string;
  pkceVerifier: string | null;
  redirectUri: string;
}

/**
 * Atomically claim and consume the OAuth challenge. Returns the trusted
 * server-stored `(organizationId, userId, redirectUri, pkceVerifier)` tuple,
 * or `null` if any guard fails (cookie missing, mismatch with callback state,
 * row already consumed, expired, or wrong provider).
 *
 * The atomic `updateMany` ensures only one caller can flip `consumedAt` even
 * if the IdP redirects twice or an attacker replays the URL — the second
 * caller's count will be 0 and we return null.
 */
export async function consumeOAuthChallenge(
  input: ConsumeOAuthChallengeInput,
): Promise<ConsumedOAuthChallenge | null> {
  // Cookie must exist AND match the state echoed back from the IdP. Without
  // both, the request did not originate in this browser.
  if (!input.cookieState) return null;
  if (input.cookieState !== input.callbackState) return null;

  const stateHash = hashOAuthState(input.callbackState);
  const now = new Date();

  const claim = await delegate(input.db).updateMany({
    where: {
      stateHash,
      provider: input.expectedProvider,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });

  if (claim.count !== 1) {
    // Either the row never existed (forged state), already consumed (replay),
    // expired, or provider mismatch (cross-provider CSRF). All four collapse
    // into one rejection so the response shape doesn't leak which guard fired.
    return null;
  }

  const row = await delegate(input.db).findFirst({ where: { stateHash } });
  if (!row) return null;

  return {
    organizationId: row.organizationId,
    userId: row.userId,
    pkceVerifier: row.pkceVerifier,
    redirectUri: row.redirectUri,
  };
}

/**
 * Hygiene helper — delete expired challenges. Called from the data-purge
 * cron schedule to keep the table small. Safe to run concurrently because it
 * only targets rows whose expiresAt is already in the past.
 */
export async function purgeExpiredOAuthChallenges(db: unknown): Promise<number> {
  const result = await delegate(db).deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
