import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSigningAuditTrail(envelopeId: string, open: boolean) {
  const trpc = useTRPC();

  const detailQuery = useQuery(
    trpc.esign.getEnvelopeDetail.queryOptions({ envelopeId }, { enabled: open && !!envelopeId }),
  );

  const envelope = detailQuery.data;
  const events = ((envelope as Record<string, unknown> | undefined)?.events ?? []) as Array<{
    id: string;
    eventType: string;
    description: string;
    actorName: string | null;
    occurredAt: string | Date;
  }>;

  return {
    events,
    isLoading: detailQuery.isPending,
  } as const;
}
