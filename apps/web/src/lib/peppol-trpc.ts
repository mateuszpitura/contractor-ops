/**
 * Peppol tRPC accessor — workaround for TypeScript type instantiation depth
 * limit with 40+ routers in AppRouter.
 *
 * The `trpc.peppol` property is valid at runtime but TypeScript cannot resolve
 * it when the AppRouter has too many sub-routers. This file provides a typed
 * accessor that bypasses the depth limitation.
 *
 * When the upstream tRPC type depth issue is resolved, remove this file and
 * use `trpc.peppol` directly.
 */

import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types matching tRPC router output
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Typed accessor
// ---------------------------------------------------------------------------

interface PeppolTrpcProxy {
  getTransmissionByInvoiceId: {
    queryOptions: (input: { invoiceId: string }) => { queryKey: unknown[] };
    queryKey: () => unknown[];
  };
}

export const peppolTrpc = (trpc as Record<string, unknown>).peppol as PeppolTrpcProxy;
