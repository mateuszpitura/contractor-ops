import type { FlagKey, LazyFlagBag } from '@contractor-ops/feature-flags';
import { lazyFlagBag } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { FEATURE_FLAG_UNAVAILABLE } from '../errors';
import { t } from '../init';
import { apiKeyTenantProcedure } from './api-key-auth';
import { tenantProcedure } from './tenant';

const log = createLogger({ service: 'feature-flags' });

// ---------------------------------------------------------------------------
// Feature flag middleware
// ---------------------------------------------------------------------------

/**
 * Internal helper — reads the tenant-scoped fields from ctx and returns a
 * lazily-materialized flag bag. Inlined into the per-procedure middleware
 * below so TypeScript infers the post-tenant ctx shape (with
 * `organizationId`, `region`) without us having to widen the base context.
 */
function buildLazyBag(ctx: {
  user: { id: string } | null;
  organizationId: string;
  region: string;
  authMode?: 'session' | 'apiKey' | 'cron' | 'portal';
}): LazyFlagBag {
  let region: 'EU' | 'ME' | 'US';
  if (ctx.region === 'ME') {
    region = 'ME';
  } else if (ctx.region === 'US') {
    // US is a supported region (FOUND7-03) — it must NOT fall into the
    // unknown→EU branch. Silently coercing US data context to EU would be a
    // data-residency leak (T-82-02-01), so US gets an explicit branch.
    region = 'US';
  } else if (ctx.region === 'EU') {
    region = 'EU';
  } else {
    // Genuinely-unknown region — should never happen (tenant middleware
    // guarantees a supported region), but if it does we fail closed by picking
    // the safer default. The log gives ops visibility; without it, a future
    // region addition would silently degrade to EU.
    log.warn(
      { region: ctx.region, organizationId: ctx.organizationId },
      'unexpected ctx.region; coercing to EU and using jurisdiction short-circuit',
    );
    region = 'EU';
  }
  return lazyFlagBag({
    userId: ctx.user?.id,
    organizationId: ctx.organizationId,
    region,
    authMode: ctx.authMode,
  });
}

/**
 * Session-based tRPC procedure with `ctx.flags` attached.
 *
 * Chain: auth → tenant → attachFlagBag → handler.
 *
 * The flag bag is lazily materialized — handlers that never read a flag incur
 * zero Unleash-SDK overhead.
 */
export const tenantFlaggedProcedure = tenantProcedure.use(async ({ ctx, next }) => {
  const flags = buildLazyBag(ctx);
  return next({ ctx: { ...ctx, flags } });
});

/**
 * API-key-based tRPC procedure with `ctx.flags` attached.
 *
 * Chain: apiKeyAuth → requireTier → attachFlagBag → handler.
 */
export const apiKeyTenantFlaggedProcedure = apiKeyTenantProcedure.use(async ({ ctx, next }) => {
  const flags = buildLazyBag(ctx);
  return next({ ctx: { ...ctx, flags } });
});

/**
 * Middleware factory that gates a procedure on a named feature flag.
 *
 * Must be chained AFTER a procedure that attaches `ctx.flags`
 * (e.g. {@link tenantFlaggedProcedure} or {@link apiKeyTenantFlaggedProcedure}).
 *
 * Throws `NOT_FOUND` — not `FORBIDDEN` — when the flag is off so that disabled
 * features do not leak their existence to API consumers.
 *
 * @example
 * export const router = t.router({
 *   list: tenantFlaggedProcedure
 *     .use(requireFeatureFlag('module.legal-approval'))
 *     .query(async ({ ctx }) => { ... }),
 * });
 */
export function requireFeatureFlag<K extends FlagKey>(key: K) {
  return t.middleware(({ ctx, next }) => {
    const flags = (ctx as typeof ctx & { flags?: LazyFlagBag }).flags;
    if (!flags) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: FEATURE_FLAG_UNAVAILABLE,
      });
    }
    if (!flags.isEnabled(key)) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return next({ ctx });
  });
}
