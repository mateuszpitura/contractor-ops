import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';
import { publicProcedure, t } from '../init.js';
import { resolveApiKey, touchLastUsed } from '../services/api-key-service.js';
import { runWithTenantContext } from './tenant.js';
import { requireTier } from './tier.js';

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
