import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export interface ComplianceAuditEntry {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string | Date;
}

/**
 * The only tRPC boundary for the compliance item history timeline.
 * Lazy: pass `enabled` so the audit trail is fetched only when the
 * disclosure is expanded.
 */
export function useComplianceItemHistory(itemId: string, enabled: boolean) {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.complianceAdmin.itemAuditTrail.queryOptions({ itemId }),
    enabled,
  });

  const entries = (query.data ?? []) as ComplianceAuditEntry[];
  return {
    isPending: enabled && query.isPending,
    error: query.error ?? null,
    isEmpty: enabled && !query.isPending && !query.error && entries.length === 0,
    entries,
  } as const;
}
