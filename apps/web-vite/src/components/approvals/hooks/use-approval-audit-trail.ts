import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

type AuditTrail = inferRouterOutputs<AppRouter>['approval']['getAuditTrail'];

export interface ApprovalAuditEvent {
  type: 'system' | 'decision';
  label: string;
  timestamp: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  comment?: string | null;
  levelName?: string;
  chainName?: string;
}

export function useApprovalAuditTrail(invoiceId: string, enabled = true) {
  const trpc = useTRPC();

  const auditQuery = useQuery({
    ...trpc.approval.getAuditTrail.queryOptions({ invoiceId }),
    enabled: !!invoiceId && enabled,
  });

  const data = auditQuery.data;

  return {
    data,
    events: (data?.events ?? []) as unknown as ApprovalAuditEvent[],
    flow: data?.flow as AuditTrail['flow'],
    isLoading: auditQuery.isLoading,
  } as const;
}
