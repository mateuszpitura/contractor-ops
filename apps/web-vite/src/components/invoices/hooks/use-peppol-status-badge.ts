import { useQuery } from '@tanstack/react-query';

import { getPeppolTrpc } from '../../../lib/peppol-trpc.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const REFETCH_MS = 30_000;

export type PeppolTransmissionBadgeData = {
  status: string;
  aspTransmissionId: string | null;
  receiverParticipantId: string;
};

export function usePeppolStatusBadge(invoiceId: string) {
  const trpc = useTRPC();
  const peppolTrpc = getPeppolTrpc(trpc);

  const baseQueryOpts = peppolTrpc.getTransmissionByInvoiceId.queryOptions({ invoiceId });

  const query = useQuery({
    ...baseQueryOpts,
    refetchInterval: REFETCH_MS,
  } as unknown as Parameters<typeof useQuery>[0]);

  const transmission = query.data as PeppolTransmissionBadgeData | null | undefined;

  return {
    transmission: transmission ?? null,
  } as const;
}
