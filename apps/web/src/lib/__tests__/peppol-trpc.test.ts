import { describe, expect, it, vi } from 'vitest';

const mockQueryOptions = vi.fn().mockReturnValue({ queryKey: ['peppol', 'test'] });
const mockQueryKey = vi.fn().mockReturnValue(['peppol']);

vi.mock('@/trpc/init', () => ({
  trpc: {
    peppol: {
      getTransmissionByInvoiceId: {
        queryOptions: mockQueryOptions,
        queryKey: mockQueryKey,
      },
    },
  },
}));

describe('peppol-trpc', () => {
  it('exports peppolTrpc as a typed proxy over trpc.peppol', async () => {
    const { peppolTrpc } = await import('../peppol-trpc');
    expect(peppolTrpc).toBeDefined();
    expect(peppolTrpc.getTransmissionByInvoiceId).toBeDefined();
  });

  it('peppolTrpc.getTransmissionByInvoiceId.queryOptions returns query config', async () => {
    const { peppolTrpc } = await import('../peppol-trpc');
    const result = peppolTrpc.getTransmissionByInvoiceId.queryOptions({
      invoiceId: 'inv-123',
    });
    expect(mockQueryOptions).toHaveBeenCalledWith({ invoiceId: 'inv-123' });
    expect(result).toEqual({ queryKey: ['peppol', 'test'] });
  });

  it('peppolTrpc.getTransmissionByInvoiceId.queryKey returns key array', async () => {
    const { peppolTrpc } = await import('../peppol-trpc');
    const result = peppolTrpc.getTransmissionByInvoiceId.queryKey();
    expect(mockQueryKey).toHaveBeenCalled();
    expect(result).toEqual(['peppol']);
  });
});

describe('PeppolTransmissionResult type', () => {
  it('type can be used to annotate objects with all required fields', async () => {
    const transmission: import('../peppol-trpc').PeppolTransmissionResult = {
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
  });
});
