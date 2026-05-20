'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { portalTrpc } from '@/trpc/init';

/**
 * Shared org-switcher hook for the portal top bar dropdown and the mobile
 * sheet. Holds a single in-flight target id so both surfaces show the
 * spinner on the same row and stay disabled while the cookie is being
 * planted server-side.
 *
 * Flow:
 *   1. `switchOrg` mutation mints a new portal session (signed) on the
 *      target org's regional DB.
 *   2. Result is posted to `/api/portal/set-session` which verifies the
 *      HMAC and plants the httpOnly `portal_session` cookie.
 *   3. `router.refresh()` re-evaluates the portal layout against the new
 *      session so the entire portal subtree reloads with the new org's
 *      branding, contractor data, and dashboard scope.
 */
export interface OrgSwitcherOption {
  contractorId: string;
  organizationId: string;
  orgName: string;
  orgLogo: string | null;
  isCurrent: boolean;
}

export interface UseOrgSwitcherResult {
  orgs: OrgSwitcherOption[];
  isLoading: boolean;
  isAvailable: boolean;
  switchingContractorId: string | null;
  switchTo: (target: { contractorId: string; organizationId: string }) => Promise<void>;
}

export function useOrgSwitcher(): UseOrgSwitcherResult {
  const router = useRouter();
  const [switchingContractorId, setSwitchingContractorId] = useState<string | null>(null);

  const orgsQuery = useQuery(portalTrpc.portal.listMyOrgs.queryOptions());

  const switchOrgMutation = useMutation(portalTrpc.portal.switchOrg.mutationOptions());

  const orgs = orgsQuery.data ?? [];

  async function switchTo(target: { contractorId: string; organizationId: string }) {
    if (switchingContractorId) return;
    setSwitchingContractorId(target.contractorId);
    try {
      const session = await switchOrgMutation.mutateAsync(target);

      const response = await fetch('/api/portal/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: session.rawToken,
          expiresAt:
            session.expiresAt instanceof Date
              ? session.expiresAt.toISOString()
              : new Date(session.expiresAt).toISOString(),
          signature: session.signature,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set portal session');
      }

      // Hard-reload to /portal so every server component re-runs against
      // the new cookie. router.refresh() alone leaves client-cached tRPC
      // data in place — wrong org.
      window.location.assign('/portal');
    } catch (err) {
      setSwitchingContractorId(null);
      // Surface to React Query consumers (mutation.error) — caller decides
      // whether to render an inline error toast.
      throw err;
    } finally {
      // Keep the spinner up until the hard reload kicks in; only release
      // on error (handled above).
      router.refresh();
    }
  }

  return {
    orgs,
    isLoading: orgsQuery.isLoading,
    isAvailable: orgs.length > 1,
    switchingContractorId,
    switchTo,
  };
}
