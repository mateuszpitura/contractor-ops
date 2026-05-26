import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useApprovalAuditTrail(invoiceId: string, enabled = true) {
  const trpc = useTRPC();

  const auditQuery = useQuery({
    ...trpc.approval.getAuditTrail.queryOptions({ invoiceId }),
    enabled: !!invoiceId && enabled,
  });

  const data = auditQuery.data as Record<string, unknown> | undefined;

  return {
    data,
    events: ((data?.events as Record<string, unknown>[] | undefined) ?? []) as Record<
      string,
      unknown
    >[],
    flow: data?.flow as { steps?: unknown[]; chainName?: string } | undefined,
    isLoading: auditQuery.isLoading,
  } as const;
}
