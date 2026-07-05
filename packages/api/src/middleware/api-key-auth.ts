import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { publicProcedure, t } from '../init';
import { SANDBOX_DAILY_REQUEST_QUOTA, TIER_MONTHLY_REQUEST_QUOTA } from '../lib/api-tier-limits';
import { appendApiKeyIpEvent, resolveApiKey, touchLastUsed } from '../services/api-key-service';
import {
  incrementDailyRequestCount,
  incrementMonthlyRequestCount,
} from '../services/api-quota-counter';
import { demoReadOnly } from './demo';
import { assertApiSandboxEnabled, assertPublicApiEnabled } from './require-public-api-flag';
import { runWithTenantContext } from './tenant';
import { assertMinimumTier } from './tier';

// ---------------------------------------------------------------------------
// API Key authentication middleware
// ---------------------------------------------------------------------------

const LIVE_PREFIX = 'co_live_';
const SANDBOX_PREFIX = 'co_test_';

/**
 * Middleware that authenticates requests using an Organization API Key.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Resolve key via prefix lookup + HMAC verification
 *    (revoked/expired keys are excluded at the DB level)
 * 3. Establish tenant context (regional DB + AsyncLocalStorage)
 * 4. Enrich context with authMode, apiKeyId, apiKeyScopes
 * 5. Fire-and-forget lastUsedAt update
 */
const apiKeyAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const authHeader = ctx.headers.get('authorization') ?? '';
  const BEARER = 'Bearer ';

  const plaintext = authHeader.startsWith(BEARER) ? authHeader.slice(BEARER.length) : '';
  if (!(plaintext.startsWith(LIVE_PREFIX) || plaintext.startsWith(SANDBOX_PREFIX))) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.INVALID_API_KEY,
    });
  }

  const keyRecord = await resolveApiKey(plaintext);

  if (!keyRecord) {
    // resolveApiKey returns null for: invalid key, revoked, expired, prefix mismatch
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.INVALID_API_KEY,
    });
  }

  // Reject suspended/archived orgs even if their API key is still present in
  // the DB. resolveApiKey already eagerly loads `organization.status` for
  // exactly this reason; without this gate, a non-paying or fraud-flagged
  // tenant could continue exfiltrating data via the public API as long as
  // their key was not individually revoked.
  if (keyRecord.organization.status !== 'ACTIVE') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: E.ORG_SUSPENDED,
    });
  }

  // Fire-and-forget
  touchLastUsed(keyRecord.id);
  // Fire-and-forget source-IP log — only when a client IP was captured at the
  // HTTP boundary by createPublicCaller (absent for direct in-process callers).
  if (ctx.sourceIp) {
    appendApiKeyIpEvent(keyRecord.id, keyRecord.organizationId, ctx.sourceIp, ctx.userAgent);
  }

  // Pass pre-resolved dataRegion to skip redundant org lookup
  const knownRegion = keyRecord.organization.dataRegion ?? undefined;

  return runWithTenantContext(
    keyRecord.organizationId,
    async tenantCtx =>
      next({
        ctx: {
          ...ctx,
          ...tenantCtx,
          authMode: 'apiKey' as const,
          apiKeyId: keyRecord.id,
          apiKeyScopes: keyRecord.scopes,
          apiKeyEnvironment: keyRecord.environment,
          // A sandbox key resolves only to a sandbox org (fail-closed); surface
          // it so the demo read-only guard isolates the whole request.
          isSandbox: keyRecord.organization.isSandbox,
          // Attribution actor for FK-requiring creates (never authorization).
          apiKeyActingUserId: keyRecord.actingUserId,
        },
      }),
    knownRegion,
  );
});

// ---------------------------------------------------------------------------
// Environment-branching access gate (flag + tier + quota)
// ---------------------------------------------------------------------------

/**
 * After the key resolves, gate the request by its environment:
 *
 *   - LIVE: the per-org `module.public-api` dark gate + Enterprise tier + the
 *     monthly per-tier request quota (behaviour unchanged from before).
 *   - SANDBOX: the global `module.api-sandbox` flag + the per-day 100-request
 *     cap — NO tier requirement and NO per-org `module.public-api`, so a free
 *     `co_test_` key works without a paid subscription.
 *
 * org/region/apiKeyEnvironment are enriched by apiKeyAuthMiddleware (earlier in
 * the chain); the standalone middleware type doesn't carry them, so read them
 * explicitly — the same cast the tier check uses for ctx.organizationId.
 */
const apiKeyAccessGate = t.middleware(async ({ ctx, next }) => {
  const { organizationId, region, apiKeyEnvironment } = ctx as unknown as {
    organizationId: string;
    region: string;
    apiKeyEnvironment: 'LIVE' | 'SANDBOX';
  };

  if (apiKeyEnvironment === 'SANDBOX') {
    assertApiSandboxEnabled(organizationId, region);
    const count = await incrementDailyRequestCount(organizationId);
    if (count > SANDBOX_DAILY_REQUEST_QUOTA) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: E.API_QUOTA_EXCEEDED });
    }
    return next({ ctx: { subscription: null } });
  }

  assertPublicApiEnabled(organizationId, region);
  const subscription = await assertMinimumTier(organizationId, 'ENTERPRISE');
  const limit = TIER_MONTHLY_REQUEST_QUOTA[subscription.tier];
  if (Number.isFinite(limit)) {
    const count = await incrementMonthlyRequestCount(organizationId);
    if (count > limit) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: E.API_QUOTA_EXCEEDED });
    }
  }
  return next({ ctx: { subscription } });
});

// ---------------------------------------------------------------------------
// Exported procedure
// ---------------------------------------------------------------------------

/**
 * Procedure for public API endpoints authenticated via Organization API Key.
 *
 * Chain: publicProcedure → apiKeyAuth → apiKeyAccessGate (flag + tier + quota,
 *        branched on the key environment) → demoReadOnly → handler
 *
 * Provides: ctx.db, ctx.organizationId, ctx.region, ctx.authMode,
 *           ctx.apiKeyId, ctx.apiKeyScopes, ctx.apiKeyActingUserId,
 *           ctx.apiKeyEnvironment, ctx.isSandbox, ctx.subscription
 */
export const apiKeyTenantProcedure = publicProcedure
  .use(apiKeyAuthMiddleware)
  .use(apiKeyAccessGate)
  .use(demoReadOnly);
