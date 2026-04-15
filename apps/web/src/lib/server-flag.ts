import 'server-only';

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import type { FlagKey } from '@contractor-ops/feature-flags';
import { buildFlagBag } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { headers } from 'next/headers';

/**
 * Server-side feature-flag evaluator for Next.js server components.
 *
 * Mirrors the logic in `app/[locale]/(dashboard)/layout.tsx` but returns a
 * single boolean for a single key so callers can short-circuit rendering
 * (e.g., call `notFound()` when the flag is off).
 *
 * Fails closed on any error — an evaluator crash can never *grant* access
 * to a gated route.
 */
export async function getServerFlag(key: FlagKey): Promise<boolean> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session) return false;

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) return false;

    const [org, member] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: activeOrgId },
        select: { id: true, dataRegion: true, countryCode: true },
      }),
      prisma.member.findFirst({
        where: { organizationId: activeOrgId, userId: session.user.id },
        select: { role: true },
      }),
    ]);
    if (!org) return false;

    const { values } = buildFlagBag({
      userId: session.user.id,
      organizationId: org.id,
      region: org.dataRegion === 'ME' ? 'ME' : 'EU',
      countryCode: org.countryCode ?? undefined,
      role: member?.role ?? undefined,
      authMode: 'session',
    });

    return values[key] === true;
  } catch (err) {
    createLogger({ service: 'feature-flags', procedure: 'getServerFlag' }).error(
      { err: err instanceof Error ? err.message : String(err), key },
      'server flag evaluation failed — failing closed',
    );
    return false;
  }
}
