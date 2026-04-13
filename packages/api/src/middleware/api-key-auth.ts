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
 * 2. Resolve key via prefix lookup + scrypt verification
 * 3. Validate key is not revoked or expired
 * 4. Establish tenant context (regional DB + AsyncLocalStorage)
 * 5. Enrich context with authMode, apiKeyId, apiKeyScopes
 * 6. Fire-and-forget lastUsedAt update
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
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.INVALID_API_KEY,
    });
  }

  if (keyRecord.revokedAt) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.API_KEY_REVOKED,
    });
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: E.API_KEY_EXPIRED,
    });
  }

  // Fire-and-forget
  touchLastUsed(keyRecord.id);

  return runWithTenantContext(keyRecord.organizationId, async tenantCtx =>
    next({
      ctx: {
        ...ctx,
        ...tenantCtx,
        authMode: 'apiKey' as const,
        apiKeyId: keyRecord.id,
        apiKeyScopes: keyRecord.scopes,
      },
    }),
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
