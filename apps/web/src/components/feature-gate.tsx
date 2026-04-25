// apps/web/src/components/feature-gate.tsx
//
// Phase 64 · D-03 — Generic RSC feature-gate wrapper (LEGAL-08).
//
// Returns {children} when the flag is ON, null when OFF.
// Returns null (not display:none, not CSS hidden — no DOM node at all).
// Used to wrap: sidebar classification nav entry, contractor profile
// classification tab/tile, compliance health dashboard classification
// section, economic dependency alert widget.

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import type { FlagKey } from '@contractor-ops/feature-flags';
import { evaluate } from '@contractor-ops/feature-flags';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

interface FeatureGateProps {
  flag: FlagKey;
  children: ReactNode;
  fallback?: ReactNode; // Optional fallback when flag is off (default: null)
}

export async function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.session.activeOrganizationId) {
    return <>{fallback}</>;
  }

  const org = await prisma.organization.findFirst({
    where: { id: session.session.activeOrganizationId },
    select: { dataRegion: true, countryCode: true },
  });

  const region = org?.dataRegion === 'ME' ? ('ME' as const) : ('EU' as const);
  const result = evaluate(flag, {
    organizationId: session.session.activeOrganizationId,
    region,
    countryCode: org?.countryCode ?? undefined,
  });

  if (!result.enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
