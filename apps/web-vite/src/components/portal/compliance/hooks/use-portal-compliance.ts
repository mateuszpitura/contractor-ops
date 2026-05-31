import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../../providers/trpc-provider.js';

const ATTENTION_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;

export interface PortalComplianceItem {
  id: string;
  name: string;
  documentType: string;
  policyRuleId: string | null;
  status: string;
  severity: string | null;
  expiresAt: string | Date | null;
}

/**
 * Phase 73 COMPL-04 — the only tRPC boundary for the portal compliance surface.
 * Reads the logged-in contractor's own items (server-scoped to the portal
 * session). Also derives `attentionItems` (MISSING/EXPIRED or expiring within
 * 30d) for the home banner.
 */
export function usePortalCompliance() {
  const trpc = usePortalTRPC();
  const query = useQuery(trpc.portal.complianceItems.queryOptions());

  const items = (query.data ?? []) as PortalComplianceItem[];
  const now = Date.now();
  const attentionItems = items.filter(item => {
    if (item.status === 'MISSING' || item.status === 'EXPIRED') return true;
    if (item.status === 'SATISFIED' && item.expiresAt) {
      return new Date(item.expiresAt).getTime() - now <= ATTENTION_LOOKAHEAD_MS;
    }
    return false;
  });

  return {
    isPending: query.isPending,
    error: query.error ?? null,
    isEmpty: !(query.isPending || query.error) && items.length === 0,
    items,
    attentionItems,
  } as const;
}
