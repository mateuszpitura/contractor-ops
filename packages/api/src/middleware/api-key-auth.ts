import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { publicProcedure, t } from '../init';
import { resolveApiKey, touchLastUsed } from '../services/api-key-service';
import { runWithTenantContext } from './tenant';
import { requireTier } from './tier';

// ---------------------------------------------------------------------------
// API Key authentication middleware
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co_live_';

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

  if (!authHeader.startsWith(`Bearer ${KEY_PREFIX}`)) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.INVALID_API_KEY,
    });
  }

  const plaintext = authHeader.slice('Bearer '.length);
  const keyRecord = await resolveApiKey(plaintext);

  if (!keyRecord) {
    // resolveApiKey returns null for: invalid key, revoked, expired, prefix mismatch
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.INVALID_API_KEY,
    });
  }

  // F-SEC-12 — Reject suspended/archived orgs even if their API key is still
  // present in the DB. resolveApiKey already eagerly loads `organization.status`
  // for exactly this reason; without this gate, a non-paying or fraud-flagged
  // tenant could continue exfiltrating data via the public API as long as their
  // key was not individually revoked.
  if (keyRecord.organization.status !== 'ACTIVE') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: E.ORG_SUSPENDED,
    });
  }

  // Fire-and-forget
  touchLastUsed(keyRecord.id);

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
        },
      }),
    knownRegion,
  );
});

// ---------------------------------------------------------------------------
// Exported procedure
// ---------------------------------------------------------------------------

/**
 * Procedure for public API endpoints authenticated via Organization API Key.
 *
 * Chain: publicProcedure → apiKeyAuth → requireTier(ENTERPRISE) → handler
 *
 * Provides: ctx.db, ctx.organizationId, ctx.region, ctx.authMode,
 *           ctx.apiKeyId, ctx.apiKeyScopes, ctx.subscription
 */
export const apiKeyTenantProcedure = publicProcedure
  .use(apiKeyAuthMiddleware)
  .use(requireTier('ENTERPRISE'));
