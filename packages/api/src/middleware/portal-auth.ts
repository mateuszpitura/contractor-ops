import { tenantStore } from "@contractor-ops/db";
import { TRPCError } from "@trpc/server";
import { publicProcedure, t } from "../init.js";
import { validatePortalSession } from "../services/portal-session.js";

// ---------------------------------------------------------------------------
// Cookie parsing
// ---------------------------------------------------------------------------

/**
 * Extract the portal_session cookie value from a raw Cookie header string.
 * Uses manual parsing to avoid pulling in a cookie-parsing dependency.
 */
function parsePortalCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith("portal_session=")) {
      return cookie.slice("portal_session=".length);
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
 *    contractorId, and organizationId.
 *
 * Throws UNAUTHORIZED if no cookie is present or session is invalid/expired.
 */
const portalAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const cookieHeader = ctx.headers.get("cookie");

  if (!cookieHeader) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const rawToken = parsePortalCookie(cookieHeader);

  if (!rawToken) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const session = await validatePortalSession(rawToken);

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Read subdomain header set by Next.js middleware (supplementary context)
  // Session.organizationId remains authoritative for tenantStore scoping.
  // The subdomain is passed as context metadata for logging/audit/rate-limiting.
  const portalSubdomain = ctx.headers.get("x-portal-org-subdomain") ?? null;

  return tenantStore.run({ organizationId: session.organizationId }, () =>
    next({
      ctx: {
        ...ctx,
        portalSession: session,
        contractorId: session.contractorId,
        organizationId: session.organizationId,
        contractor: session.contractor,
        portalSubdomain,
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
 * and ctx.contractor to all downstream handlers.
 */
export const portalProcedure = publicProcedure.use(portalAuthMiddleware);
