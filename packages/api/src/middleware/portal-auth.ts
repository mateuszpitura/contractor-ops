import type { DataRegion } from '@contractor-ops/db';
import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { evaluate } from '@contractor-ops/feature-flags';
import { TRPCError } from '@trpc/server';
import { EMPLOYEE_PORTAL_DISABLED, PORTAL_NOT_A_MANAGER } from '../errors';
import { publicProcedure, t } from '../init';
import { validatePortalSession } from '../services/portal-session';
import { demoReadOnly } from './demo';

/**
 * Assert the employee-portal surface is enabled for the org; throws FORBIDDEN
 * otherwise. The flag is jurisdiction 'ANY'; the Unleash client is picked by
 * region, so coerce to a region the regional client map recognises.
 */
function assertEmployeePortalEnabled(organizationId: string, region: DataRegion): void {
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);
  const result = evaluate('module.employee-portal', { organizationId, region: evalRegion });
  if (!result.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: EMPLOYEE_PORTAL_DISABLED,
      cause: { flag: 'module.employee-portal', reason: result.reason },
    });
  }
}

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------

/**
 * Extract the portal_session cookie value from a raw Cookie header string.
 * Uses manual parsing to avoid pulling in a cookie-parsing dependency.
 */
function parsePortalCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split('; ');
  for (const cookie of cookies) {
    if (cookie.startsWith('portal_session=')) {
      return cookie.slice('portal_session='.length);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Portal auth middleware
// ---------------------------------------------------------------------------

/**
 * Portal authentication middleware.
 *
 * 1. Extracts `portal_session` cookie from request headers.
 * 2. Validates the session token (checks existence + expiry).
 * 3. Wraps downstream handlers in tenantStore.run() for automatic
 *    organization-scoped Prisma queries.
 * 4. Extends context with portal session data, contractor info,
 *    contractorId, organizationId, region, and regional `db` (same pattern as tenant middleware).
 *
 * Throws UNAUTHORIZED if no cookie is present or session is invalid/expired.
 */
const portalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const cookieHeader = ctx.headers.get('cookie');

  if (!cookieHeader) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const rawToken = parsePortalCookie(cookieHeader);

  if (!rawToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const session = await validatePortalSession(rawToken);

  if (!session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // This middleware serves the contractor portal subject only. The session row's
  // contractor id/relation are nullable at the schema level (an employee subject
  // leaves them null), so narrow them to non-null here — a session reaching this
  // middleware without a contractor is not a valid contractor session. Bound to
  // const locals so the narrowing survives into the tenantStore.run closure.
  const { contractorId, contractor } = session;
  if (contractorId === null || contractor === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Read subdomain header set by Next.js middleware (supplementary context)
  // Session.organizationId remains authoritative for tenantStore scoping.
  // The subdomain is passed as context metadata for logging/audit/rate-limiting.
  const portalSubdomain = ctx.headers.get('x-portal-org-subdomain') ?? null;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { dataRegion: true },
  });
  const region: DataRegion = org?.dataRegion ?? 'EU';

  const regionalPrisma = getRegionalClient(region);
  const scopedClient = createTenantClientFrom(regionalPrisma);

  return tenantStore.run({ organizationId: session.organizationId, region }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        subjectType: 'CONTRACTOR' as const,
        contractorId,
        organizationId: session.organizationId,
        contractor,
        portalSubdomain,
        region,
        db: scopedClient,
      },
    }),
  );
});

// ---------------------------------------------------------------------------
// Employee portal auth middleware
// ---------------------------------------------------------------------------

/**
 * Employee portal authentication middleware — the EMPLOYEE sibling of
 * `portalAuthMiddleware`.
 *
 * Rejects UNAUTHORIZED unless the validated session's subject is EMPLOYEE, then
 * asserts the `module.employee-portal` flag for the org (FORBIDDEN when dark) and
 * attaches `ctx.workerId` + `ctx.worker` + `ctx.employeeProfile` — NEVER
 * `ctx.contractorId`. The tenant-scoped regional `db` runs inside `tenantStore`,
 * identical to the contractor path.
 */
const portalEmployeeAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const cookieHeader = ctx.headers.get('cookie');
  if (!cookieHeader) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const rawToken = parsePortalCookie(cookieHeader);
  if (!rawToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const session = await validatePortalSession(rawToken);
  if (!session || session.subjectType !== 'EMPLOYEE') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // EMPLOYEE branch: worker is non-null; narrow workerId to a const local so it
  // survives into the tenantStore.run closure.
  const { workerId } = session;
  if (workerId === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const { worker, employeeProfile } = session;

  const portalSubdomain = ctx.headers.get('x-portal-org-subdomain') ?? null;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { dataRegion: true },
  });
  const region: DataRegion = org?.dataRegion ?? 'EU';

  assertEmployeePortalEnabled(session.organizationId, region);

  const scopedClient = createTenantClientFrom(getRegionalClient(region));

  return tenantStore.run({ organizationId: session.organizationId, region }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        subjectType: 'EMPLOYEE' as const,
        workerId,
        worker,
        employeeProfile,
        organizationId: session.organizationId,
        portalSubdomain,
        region,
        db: scopedClient,
      },
    }),
  );
});

// ---------------------------------------------------------------------------
// Exported procedures
// ---------------------------------------------------------------------------

/**
 * Procedure for unauthenticated portal endpoints (magic link request,
 * magic link verification). Semantically marks portal-public routes
 * while using the same base publicProcedure.
 */
export const portalPublicProcedure = publicProcedure;

/**
 * Procedure for authenticated portal endpoints.
 * Chain: publicProcedure -> portalAuthMiddleware -> handler
 *
 * Provides ctx.portalSession, ctx.contractorId, ctx.organizationId,
 * ctx.region, ctx.db, and ctx.contractor to all downstream handlers.
 */
export const portalProcedure = publicProcedure.use(portalAuthMiddleware).use(demoReadOnly);

/**
 * Procedure for authenticated EMPLOYEE portal endpoints.
 * Chain: publicProcedure -> portalEmployeeAuthMiddleware -> handler
 *
 * Provides ctx.portalSession, ctx.workerId, ctx.worker, ctx.employeeProfile,
 * ctx.organizationId, ctx.region, ctx.db — and NEVER ctx.contractorId. Asserts
 * `module.employee-portal` per request.
 */
export const portalEmployeeProcedure = publicProcedure
  .use(portalEmployeeAuthMiddleware)
  .use(demoReadOnly);

/**
 * Accepts either CONTRACTOR or EMPLOYEE portal sessions — used by layout
 * session reads that must work for both subject types (login round-trip).
 */
const portalAnySubjectAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const cookieHeader = ctx.headers.get('cookie');
  if (!cookieHeader) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const rawToken = parsePortalCookie(cookieHeader);
  if (!rawToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const session = await validatePortalSession(rawToken);
  if (!session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const portalSubdomain = ctx.headers.get('x-portal-org-subdomain') ?? null;
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { dataRegion: true },
  });
  const region: DataRegion = org?.dataRegion ?? 'EU';
  const scopedClient = createTenantClientFrom(getRegionalClient(region));

  if (session.subjectType === 'EMPLOYEE') {
    const { workerId } = session;
    if (workerId === null) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    assertEmployeePortalEnabled(session.organizationId, region);
    const { worker, employeeProfile } = session;
    return tenantStore.run({ organizationId: session.organizationId, region }, () =>
      next({
        ctx: {
          ...ctx,
          portalSession: session,
          subjectType: 'EMPLOYEE' as const,
          workerId,
          worker,
          employeeProfile,
          organizationId: session.organizationId,
          portalSubdomain,
          region,
          db: scopedClient,
        },
      }),
    );
  }

  const { contractorId, contractor } = session;
  if (contractorId === null || contractor === null) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return tenantStore.run({ organizationId: session.organizationId, region }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        subjectType: 'CONTRACTOR' as const,
        contractorId,
        organizationId: session.organizationId,
        contractor,
        portalSubdomain,
        region,
        db: scopedClient,
      },
    }),
  );
});

export const portalAnySubjectProcedure = publicProcedure
  .use(portalAnySubjectAuthMiddleware)
  .use(demoReadOnly);

/**
 * Procedure for authenticated employee MANAGER portal endpoints — extends
 * `portalEmployeeProcedure` and asserts the caller has at least one direct
 * report (an EmployeeProfile whose `managerWorkerId` is the caller). A
 * non-manager gets FORBIDDEN, so the whole manager surface is invisible to
 * employees with no reports.
 */
export const portalManagerProcedure = portalEmployeeProcedure.use(async ({ ctx, next }) => {
  const reportCount = await ctx.db.employeeProfile.count({
    where: { managerWorkerId: ctx.workerId, organizationId: ctx.organizationId },
  });
  if (reportCount === 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: PORTAL_NOT_A_MANAGER });
  }
  return next();
});
