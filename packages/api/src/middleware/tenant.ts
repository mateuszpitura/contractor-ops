import {
  createTenantClientFrom,
  getRegionalClient,
  tenantStore,
  withRlsReads,
  withRlsTransactions,
} from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { t } from '../init';
import { getOrgMeta, invalidateOrgBranding, invalidateOrgMeta } from '../services/org-cache';
import { authedProcedure } from './auth';

// ---------------------------------------------------------------------------
// Org-meta cache invalidation — F-DB-03 — wraps the tenant-scoped client with
// a Prisma extension that drops the cached `org:${id}:meta` envelope whenever
// any caller updates or deletes the Organization row.
// ---------------------------------------------------------------------------

type OrgMutationArgs = {
  where?: { id?: unknown };
  data?: { id?: unknown };
};

/**
 * Layers an Organization-write invalidation extension on top of the tenant +
 * soft-delete client returned by `createTenantClientFrom`. Lives in the api
 * package because the org-cache itself lives here; the db package can stay
 * cache-agnostic.
 *
 * Fire-and-forget invalidation: cache failures are logged inside
 * `invalidateOrgMeta` but never propagate to the caller. Mutation result
 * shape is preserved verbatim.
 */
function withOrgCacheInvalidation<T extends ReturnType<typeof createTenantClientFrom>>(
  client: T,
): T {
  // In tests the mocked Prisma client typically lacks `$extends`. The
  // invalidation hook is a defense-in-depth nicety, not a correctness
  // requirement (cache TTL bounds staleness regardless), so skip cleanly.
  if (typeof (client as unknown as { $extends?: unknown }).$extends !== 'function') {
    return client;
  }
  return client.$extends({
    query: {
      organization: {
        async update({ args, query }) {
          const result = await query(args);
          const orgId = (args as OrgMutationArgs).where?.id ?? (args as OrgMutationArgs).data?.id;
          if (typeof orgId === 'string') {
            void invalidateOrgMeta(orgId);
            void invalidateOrgBranding(orgId);
          }
          return result;
        },
        async delete({ args, query }) {
          const result = await query(args);
          const orgId = (args as OrgMutationArgs).where?.id;
          if (typeof orgId === 'string') {
            void invalidateOrgMeta(orgId);
            void invalidateOrgBranding(orgId);
          }
          return result;
        },
      },
    },
  }) as unknown as T;
}

// ---------------------------------------------------------------------------
// Shared tenant context setup — reusable across session & API key auth flows
// ---------------------------------------------------------------------------

/**
 * Resolves an organization's data region, creates a tenant-scoped Prisma client,
 * and runs the callback inside AsyncLocalStorage with the tenant context set.
 *
 * This is the shared core extracted from tenantMiddleware so that both
 * session-based and API-key-based auth flows can establish tenant context
 * without duplicating the region lookup + client setup logic.
 */
export async function runWithTenantContext<T>(
  orgId: string,
  fn: (ctx: {
    organizationId: string;
    region: string;
    db: ReturnType<typeof createTenantClientFrom>;
  }) => Promise<T>,
  /** Pre-resolved data region — skips the DB lookup when available. */
  knownRegion?: string,
  /**
   * Optional acting user id used by F-DB-04 RLS `SET LOCAL app.user_id`.
   * Falls back to `''` when caller cannot supply (e.g. system contexts);
   * `set_config` accepts the empty string and the future RLS policies treat
   * it as "no user" (org-scope only).
   */
  userId?: string,
): Promise<T> {
  let region = knownRegion;

  if (!region) {
    // F-DB-03 — read-through Upstash Redis cache (5min TTL, key `org:${id}:meta`).
    // Falls back to a single Prisma findUnique on miss; degrades to direct DB
    // when Redis is unavailable.
    const meta = await getOrgMeta(orgId);
    region = meta?.dataRegion ?? 'EU';
  }

  const regionalPrisma = getRegionalClient(region);
  // F-DB-04 — RLS defense-in-depth, two layers:
  //
  //   1. `withRlsTransactions` wraps the callback overload of `$transaction`
  //      so every interactive transaction issues `SET LOCAL app.org_id = ...`
  //      as its first statement. Covers ALL writes that go through a tx.
  //
  //   2. `withRlsReads` wraps READ operations on a SCOPED set of high-blast-
  //      radius models (Document, Invoice, Contractor, ApprovalStep,
  //      Notification — see `RLS_READ_SCOPED_MODELS`). Each wrapped read
  //      opens a one-shot tx so SET LOCAL is in scope on the read path too,
  //      where the F-SEC-01 file-download IDOR risk surface lives.
  //
  // Trade-off (see `withRlsReads` jsdoc): wrapped reads pay +1 RTT to open a
  // tx and +2 statements for `set_config`. We accept that cost on the chosen
  // tables because the alternative — wrapping every read — would penalise
  // dashboards/lists that already dominate p50 latency. Other tenant-scoped
  // models retain the pure-read fast path (still org-scoped via the tenant
  // Prisma extension; just no DB-level second guard until policies exist).
  //
  // The audit notes there are no DB-level RLS policies yet (deferred to a
  // separate migration); this is defense-in-depth scaffolding so a future
  // `CREATE POLICY ... USING (organization_id = current_setting('app.org_id'))`
  // migration is a no-code-change rollout.
  //
  // Order matters: `withRlsReads` MUST wrap BEFORE `withRlsTransactions` so
  // the inner `$transaction` it opens is the unwrapped one (otherwise we'd
  // double-issue `set_config` per nested tx — harmless but wasteful).
  const extended = withOrgCacheInvalidation(createTenantClientFrom(regionalPrisma));
  const rlsCtx = { organizationId: orgId, userId: userId ?? '' };
  const scopedClient = withRlsTransactions(withRlsReads(extended, rlsCtx), rlsCtx);

  return tenantStore.run({ organizationId: orgId, region }, () =>
    fn({ organizationId: orgId, region, db: scopedClient }),
  );
}

/**
 * F-SEC-12 — Reject suspended/archived organizations from the tenant flow.
 * Returns the cached meta envelope so the caller can reuse the resolved
 * dataRegion and skip the second cache hit inside `runWithTenantContext`.
 *
 * F-DB-03 — single read-through cache hit covers both status and region.
 */
async function loadAndAssertActive(orgId: string): Promise<{ region: string }> {
  const meta = await getOrgMeta(orgId);

  if (!meta || meta.status !== 'ACTIVE') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: E.ORG_SUSPENDED,
    });
  }

  return { region: meta.dataRegion };
}

// ---------------------------------------------------------------------------
// Tenant middleware (session-based)
// ---------------------------------------------------------------------------

/**
 * Tenant middleware: enforces an active organization, resolves its data region,
 * and sets up the AsyncLocalStorage context with a region-aware Prisma client.
 *
 * Must be chained after auth middleware (session must exist in ctx).
 * Throws FORBIDDEN if no active organization is set in the session.
 */
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!(ctx.session && ctx.user)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const orgId = ctx.session.session.activeOrganizationId;

  if (!orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'errors.tenant.noActiveOrganization',
    });
  }

  // F-SEC-12 + F-DB-03 — Single cache hit returns dataRegion *and* asserts
  // ACTIVE status so we don't pay two Redis round-trips per request.
  const { region } = await loadAndAssertActive(orgId);

  // Preserve narrowed session/user types from the auth middleware through the spread.
  const session = ctx.session;
  const user = ctx.user;

  return runWithTenantContext(
    orgId,
    async tenantCtx => next({ ctx: { ...ctx, ...tenantCtx, session, user } }),
    region,
    user.id,
  );
});

/**
 * Procedure that requires authentication + active organization.
 * Chain: auth -> tenant -> handler
 *
 * Provides ctx.db (region-aware, tenant-scoped Prisma client) and ctx.region.
 */
export const tenantProcedure = authedProcedure.use(tenantMiddleware);
