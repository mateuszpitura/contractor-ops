/**
 * `getPeppolTrpc` — accessor that casts the tRPC v11 proxy down to a narrow
 * `peppol` namespace shape, sidestepping the AppRouter type-instantiation
 * depth limit. The runtime contract is a thin passthrough: feeding it a
 * proxy must return its `peppol` subtree unchanged.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PeppolTransmissionResult } from '../peppol-trpc.js';
import { getPeppolTrpc } from '../peppol-trpc.js';

describe('getPeppolTrpc', () => {
  it('returns the peppol subtree of the supplied tRPC proxy', () => {
    const peppolLeaf = {
      getTransmissionByInvoiceId: {
        queryOptions: (input: { invoiceId: string }) => ({ queryKey: ['peppol', input] }),
        queryKey: () => ['peppol'],
      },
    };
    const fakeTrpc = { peppol: peppolLeaf } as unknown as Parameters<typeof getPeppolTrpc>[0];
    const result = getPeppolTrpc(fakeTrpc);
    expect(result).toBe(peppolLeaf);
    expect(result.getTransmissionByInvoiceId).toBe(peppolLeaf.getTransmissionByInvoiceId);
  });

  it('forwards queryOptions input to the underlying procedure', () => {
    const queryOptions = vi.fn((input: { invoiceId: string }) => ({
      queryKey: ['peppol', 'byInvoice', input.invoiceId],
    }));
    const fakeTrpc = {
      peppol: {
        getTransmissionByInvoiceId: {
          queryOptions,
          queryKey: () => ['peppol'],
        },
      },
    } as unknown as Parameters<typeof getPeppolTrpc>[0];
    const peppol = getPeppolTrpc(fakeTrpc);
    const out = peppol.getTransmissionByInvoiceId.queryOptions({ invoiceId: 'inv-123' });
    expect(queryOptions).toHaveBeenCalledWith({ invoiceId: 'inv-123' });
    expect(out.queryKey).toEqual(['peppol', 'byInvoice', 'inv-123']);
  });
});

describe('PeppolTransmissionResult type', () => {
  it('shape accepts all required transmission fields', () => {
    const transmission: PeppolTransmissionResult = {
      id: 'tx-1',
      status: 'DELIVERED',
      direction: 'OUTBOUND',
      aspTransmissionId: 'asp-1',
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      transmittedAt: '2026-01-01T00:00:00Z',
      deliveredAt: '2026-01-01T00:01:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      errorMessage: null,
      receiverParticipantId: '0192:123456789',
      receiverSchemeId: 'iso6523-actorid-upis',
      invoiceId: 'inv-456',
    };
    expect(transmission.id).toBe('tx-1');
    expect(transmission.status).toBe('DELIVERED');
    expect(transmission.errorMessage).toBeNull();
  });

  it('nullable fields accept null', () => {
    const transmission: PeppolTransmissionResult = {
      id: 'tx-2',
      status: 'PENDING',
      direction: 'INBOUND',
      aspTransmissionId: null,
      documentTypeId: null,
      transmittedAt: null,
      deliveredAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      errorMessage: null,
      receiverParticipantId: '0192:999',
      receiverSchemeId: 'iso6523-actorid-upis',
      invoiceId: 'inv-789',
    };
    expect(transmission.aspTransmissionId).toBeNull();
    expect(transmission.transmittedAt).toBeNull();
  });
});
