// apps/web/src/lib/admin-auth.ts
//
// F-SEC-04 — Shared server-side authorization helper for `/admin/*` surfaces.
//
// The admin shell hosts cross-tenant operator surfaces (BoE base-rate
// management, classification-engine flag overview). Access requires BOTH:
//   1. Active session organization id == PLATFORM_OPERATOR_ORG_ID
//   2. Caller's membership in that org carries the `platform_operator` role
//
// The previous gate granted access to any user whose role was `owner` in any
// org (everyone is automatically owner of orgs they create). See
// .audit-2026-05-03/02-security.md for the full attack scenario.
//
// This helper is called by the admin layout AND each individual admin page so
// the layout is not the sole gate (defense-in-depth).

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

const log = createLogger({ component: 'admin-auth' });

export type PlatformOperatorContext = {
  userId: string;
  organizationId: string;
};

/**
 * Resolves the current session and verifies the caller is a platform
 * operator. On any failure (no session, no active org, wrong org, wrong
 * role, env missing) calls Next.js `notFound()` which throws — surfacing
 * the standard 404 page rather than leaking the existence of admin
 * surfaces to unauthorized callers.
 *
 * Logs a structured warn event for every rejection so production probes
 * remain debuggable.
 */
export async function requirePlatformOperator(): Promise<PlatformOperatorContext> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const platformOperatorOrgId = getServerEnv().PLATFORM_OPERATOR_ORG_ID;

  if (!session) {
    log.warn({ reason: 'no_session' }, 'admin access denied');
    notFound();
  }

  if (!platformOperatorOrgId) {
    log.warn(
      { reason: 'platform_operator_org_id_unset', userId: session.user.id },
      'admin access denied — PLATFORM_OPERATOR_ORG_ID is not configured',
    );
    notFound();
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId || activeOrgId !== platformOperatorOrgId) {
    log.warn(
      { reason: 'org_mismatch', userId: session.user.id, activeOrgId },
      'admin access denied',
    );
    notFound();
  }

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id, organizationId: activeOrgId },
    select: { role: true },
  });

  if (membership?.role !== 'platform_operator') {
    log.warn(
      {
        reason: 'role_mismatch',
        userId: session.user.id,
        organizationId: activeOrgId,
        role: membership?.role ?? null,
      },
      'admin access denied',
    );
    notFound();
  }

  return { userId: session.user.id, organizationId: activeOrgId };
}
