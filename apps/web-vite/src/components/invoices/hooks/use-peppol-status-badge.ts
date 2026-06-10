import { useQuery } from '@tanstack/react-query';
import type { PeppolTransmissionResult } from '../../../lib/peppol-trpc.js';
import { getPeppolTrpc } from '../../../lib/peppol-trpc.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const REFETCH_MS = 30_000;

export type PeppolTransmissionBadgeData = PeppolTransmissionResult;

export function usePeppolStatusBadge(invoiceId: string) {
  const trpc = useTRPC();
  const peppolTrpc = getPeppolTrpc(trpc);

  const query = useQuery(
    peppolTrpc.getTransmissionByInvoiceId.queryOptions(
      { invoiceId },
      { refetchInterval: REFETCH_MS },
    ),
  );

  return {
    transmission: query.data ?? null,
  } as const;
}
