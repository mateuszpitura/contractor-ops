/**
 * Peppol tRPC accessor — workaround for TypeScript type instantiation depth
 * limit with 40+ routers in AppRouter. Uses the SPA `useTRPC()` proxy.
 */

import type { useTRPC } from '../providers/trpc-provider.js';

export interface PeppolTransmissionResult {
  id: string;
  status: string;
  direction: string;
  aspTransmissionId: string | null;
  documentTypeId: string | null;
  transmittedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  receiverParticipantId: string;
  receiverSchemeId: string;
  invoiceId: string;
}

interface PeppolTrpcProxy {
  getTransmissionByInvoiceId: {
    queryOptions: (input: { invoiceId: string }) => { queryKey: unknown[] };
    queryKey: () => unknown[];
  };
}

type TrpcProxy = ReturnType<typeof useTRPC>;

export function getPeppolTrpc(trpc: TrpcProxy): PeppolTrpcProxy {
  return (trpc as unknown as Record<string, unknown>).peppol as PeppolTrpcProxy;
}
