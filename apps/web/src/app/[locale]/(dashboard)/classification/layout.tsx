// apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx
//
// Phase 64 · D-02 — Server-side classification feature flag gate (LEGAL-08).
//
// When `module.classification-engine` is OFF:
//   - notFound() is called → Next.js returns 404.
//   - The route module body never renders.
//   - No classification-specific client JS ships in that navigation.
//
// When ON:
//   - <ClassificationAdvisoryBanner> is rendered above {children} (LEGAL-03).
//   - Every classification page inherits the banner without per-page plumbing.

import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { evaluate } from '@contractor-ops/feature-flags';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ClassificationAdvisoryBanner } from '@/components/classification/advisory-banner';

interface ClassificationLayoutProps {
  children: ReactNode;
}

export default async function ClassificationLayout({ children }: ClassificationLayoutProps) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.session.activeOrganizationId) {
    notFound();
  }

  const org = await prisma.organization.findFirst({
    where: { id: session.session.activeOrganizationId },
    select: { countryCode: true, dataRegion: true },
  });

  const region = org?.dataRegion === 'ME' ? ('ME' as const) : ('EU' as const);
  const result = evaluate('module.classification-engine', {
    organizationId: session.session.activeOrganizationId,
    region,
    countryCode: org?.countryCode ?? undefined,
  });

  if (!result.enabled) {
    notFound();
  }

  return (
    <>
      <ClassificationAdvisoryBanner jurisdiction={org?.countryCode ?? 'GB'} />
      {children}
    </>
  );
}
