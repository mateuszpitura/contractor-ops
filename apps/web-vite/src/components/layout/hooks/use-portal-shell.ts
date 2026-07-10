import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

function getPortalShellStyle(brandColor: string | null | undefined): CSSProperties | undefined {
  if (!brandColor) return;
  return {
    '--portal-brand': brandColor,
    '--primary': brandColor,
  } as CSSProperties;
}

function readOrgBrandColor(org: object): string | null {
  if (!('brandColor' in org)) return null;
  const value = (org as { brandColor?: unknown }).brandColor;
  return typeof value === 'string' ? value : null;
}

export function usePortalShell() {
  const trpc = usePortalTRPC();
  const sessionQuery = useQuery(trpc.portal.getSession.queryOptions());

  const session = sessionQuery.data;
  const shouldRedirectToLogin = !sessionQuery.isPending && (sessionQuery.isError || !session);

  const displayName =
    session?.subjectType === 'EMPLOYEE'
      ? (session.worker.displayName ?? 'Employee')
      : session?.subjectType === 'CONTRACTOR'
        ? (session.contractor.displayName ?? 'Contractor')
        : 'User';

  const displayEmail =
    session?.subjectType === 'EMPLOYEE'
      ? session.worker.email
      : session?.subjectType === 'CONTRACTOR'
        ? session.contractor.email
        : '';

  return {
    isLoading: sessionQuery.isPending || shouldRedirectToLogin,
    session,
    shouldRedirectToLogin,
    shellStyle: session ? getPortalShellStyle(readOrgBrandColor(session.organization)) : undefined,
    topBarProps: session
      ? {
          orgName: session.organization.name || 'Organization',
          orgLogo: session.organization.logo,
          contractorName: displayName,
          contractorEmail: displayEmail,
        }
      : null,
  } as const;
}
