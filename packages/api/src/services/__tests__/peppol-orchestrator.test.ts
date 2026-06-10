import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {},
  prismaRaw: {},
}));

vi.mock('@contractor-ops/einvoice', () => {
  class MockPeppolAEProfile {
    generate = vi.fn().mockResolvedValue('<UBLInvoice/>');
    parse = vi.fn().mockResolvedValue({
      id: 'INV-001',
      invoiceTypeCode: '380',
      issueDate: '2026-04-01',
      dueDate: '2026-04-15',
      currencyCode: 'AED',
      supplier: { id: 'TRN-SELLER', name: 'Seller Co', country: 'AE' },
      customer: { id: 'TRN-BUYER', name: 'Buyer Co', country: 'AE' },
      lines: [],
      taxExclusiveAmount: 10000,
      taxInclusiveAmount: 10500,
      payableAmount: 10500,
      taxBreakdown: [{ taxableAmountMinor: 10000, taxAmountMinor: 500, taxCategory: 'S' }],
      profileId: 'peppol-ae',
    });
  }
  class MockPeppolAEQRCode {
    generateQR = vi.fn().mockResolvedValue(Buffer.from('mock-qr-png'));
  }
  return {
    PeppolAEProfile: MockPeppolAEProfile,
    PeppolAEQRCode: MockPeppolAEQRCode,
    PINT_AE_DOCUMENT_TYPE_ID:
      'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@uae-1.0::2.1',
  };
});

vi.mock('../invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn().mockReturnValue('dup-hash-123'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PeppolOrchestrator } from '../peppol-orchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-peppol-1';

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-001',
    issueDate: new Date('2026-04-01'),
    dueDate: new Date('2026-04-15'),
    currency: 'AED',
    sellerTaxId: 'TRN-SELLER',
    sellerName: 'Seller Co',
    buyerTaxId: 'TRN-BUYER',
    subtotalMinor: 10000,
    vatAmountMinor: 500,
    totalMinor: 10500,
    amountToPayMinor: 10500,
    vatRate: '5',
    externalInvoiceId: null,
    lines: [
      {
        lineNumber: 1,
        description: 'Service A',
        quantity: 1,
        unitPriceMinor: 10000,
        netAmountMinor: 10000,
        vatRate: '5',
        vatAmountMinor: 500,
      },
    ],
    ...overrides,
  };
}

function makeParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'part-1',
    organizationId: ORG_ID,
    participantId: '0088:seller-id',
    status: 'ACTIVE',
    ...overrides,
  };
}

function makeMockDb() {
  return {
    invoice: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeInvoice()),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'inv-new',
        ...data,
      })),
      update: vi.fn().mockResolvedValue({}),
    },
    peppolParticipant: {
      findFirst: vi.fn().mockResolvedValue(makeParticipant()),
    },
    peppolTransmission: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'tx-1',
        ...data,
      })),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'tx-1',
        ...data,
      })),
    },
  };
}

function makeMockAspAdapter() {
  return {
    transmitInvoice: vi.fn().mockResolvedValue({
      status: 'transmitted',
      transmissionId: 'asp-tx-1',
    }),
    getTransmissionStatus: vi.fn().mockResolvedValue({
      status: 'delivered',
      deliveredAt: new Date('2026-04-02'),
    }),
    pollInboundInvoices: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PeppolOrchestrator', () => {
  describe('submitOutboundInvoice', () => {
    it('generates XML, creates QR, creates transmission record, calls ASP adapter', async () => {
      const db = makeMockDb();
      const asp = makeMockAspAdapter();
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await orchestrator.submitOutboundInvoice({
        organizationId: ORG_ID,
        invoiceId: 'inv-1',
        receiverParticipantId: '0088:buyer-id',
      });

      // Loads invoice
      expect(db.invoice.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', organizationId: ORG_ID },
          include: { lines: true },
        }),
      );
      // Loads participant
      expect(db.peppolParticipant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG_ID, status: 'ACTIVE' },
        }),
      );
      // Persists QR code
      expect(db.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { qrCodeBase64: expect.stringContaining('data:image/png;base64,') },
        }),
      );
      // Creates transmission record
      expect(db.peppolTransmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            direction: 'OUTBOUND',
            status: 'PENDING',
            xmlPayload: '<UBLInvoice/>',
          }),
        }),
      );
      // Calls ASP transmit
      expect(asp.transmitInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          xml: '<UBLInvoice/>',
          senderParticipantId: '0088:seller-id',
          receiverParticipantId: '0088:buyer-id',
        }),
      );
      // Updates transmission to TRANSMITTED
      expect(db.peppolTransmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'TRANSMITTED',
            aspTransmissionId: 'asp-tx-1',
          }),
        }),
      );
    });

    it('throws when no active Peppol participant found', async () => {
      const db = makeMockDb();
      db.peppolParticipant.findFirst.mockResolvedValue(null);
      const asp = makeMockAspAdapter();
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await expect(
        orchestrator.submitOutboundInvoice({
          organizationId: ORG_ID,
          invoiceId: 'inv-1',
          receiverParticipantId: '0088:buyer-id',
        }),
      ).rejects.toThrow('No active Peppol participant');
    });

    it('marks transmission REJECTED when ASP rejects', async () => {
      const db = makeMockDb();
      const asp = makeMockAspAdapter();
      asp.transmitInvoice.mockResolvedValue({
        status: 'rejected',
        errors: [{ code: 'VAL-001', message: 'Invalid schema' }],
      });
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await orchestrator.submitOutboundInvoice({
        organizationId: ORG_ID,
        invoiceId: 'inv-1',
        receiverParticipantId: '0088:buyer-id',
      });

      expect(db.peppolTransmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            errorMessage: 'VAL-001: Invalid schema',
          }),
        }),
      );
    });

    it('marks transmission FAILED when ASP adapter throws', async () => {
      const db = makeMockDb();
      const asp = makeMockAspAdapter();
      asp.transmitInvoice.mockRejectedValue(new Error('Network timeout'));
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await orchestrator.submitOutboundInvoice({
        organizationId: ORG_ID,
        invoiceId: 'inv-1',
        receiverParticipantId: '0088:buyer-id',
      });

      expect(db.peppolTransmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Network timeout',
          }),
        }),
      );
    });
  });

  describe('processInboundInvoice', () => {
    it('creates invoice and transmission from inbound payload', async () => {
      const db = makeMockDb();
      const asp = makeMockAspAdapter();
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const result = await orchestrator.processInboundInvoice({
        organizationId: ORG_ID,
        payload: {
          documentId: 'asp-doc-001',
          xml: '<UBLInvoice/>',
          receivedAt: new Date('2026-04-01'),
          senderParticipantId: '0088:sender',
          receiverParticipantId: '0088:receiver',
        } as never,
      });

      expect(result).not.toBeNull();
      // Creates transmission record
      expect(db.peppolTransmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            direction: 'INBOUND',
            status: 'DELIVERED',
            aspTransmissionId: 'asp-doc-001',
          }),
        }),
      );
      // Creates invoice
      expect(db.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            source: 'PEPPOL',
            status: 'RECEIVED',
            matchStatus: 'UNMATCHED',
          }),
        }),
      );
    });

    it('returns null for duplicate (idempotent by aspTransmissionId)', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findFirst.mockResolvedValue({ id: 'existing-tx' });
      const asp = makeMockAspAdapter();
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const result = await orchestrator.processInboundInvoice({
        organizationId: ORG_ID,
        payload: {
          documentId: 'asp-doc-001',
          xml: '<UBLInvoice/>',
          receivedAt: new Date(),
        } as never,
      });

      expect(result).toBeNull();
      expect(db.invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTransmissionStatus', () => {
    it('maps ASP status to DB status correctly', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findUniqueOrThrow.mockResolvedValue({
        id: 'tx-1',
        aspTransmissionId: 'asp-tx-1',
      });
      const asp = makeMockAspAdapter();
      asp.getTransmissionStatus.mockResolvedValue({
        status: 'delivered',
        deliveredAt: new Date('2026-04-02'),
      });
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await orchestrator.updateTransmissionStatus('tx-1');

      expect(asp.getTransmissionStatus).toHaveBeenCalledWith('asp-tx-1');
      expect(db.peppolTransmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tx-1' },
          data: expect.objectContaining({
            status: 'DELIVERED',
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });

    it('returns transmission as-is when aspTransmissionId is null', async () => {
      const db = makeMockDb();
      const transmission = { id: 'tx-1', aspTransmissionId: null };
      db.peppolTransmission.findUniqueOrThrow.mockResolvedValue(transmission);
      const asp = makeMockAspAdapter();
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const result = await orchestrator.updateTransmissionStatus('tx-1');

      expect(result).toEqual(transmission);
      expect(asp.getTransmissionStatus).not.toHaveBeenCalled();
    });

    it('maps failed ASP status to FAILED', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findUniqueOrThrow.mockResolvedValue({
        id: 'tx-1',
        aspTransmissionId: 'asp-tx-1',
      });
      const asp = makeMockAspAdapter();
      asp.getTransmissionStatus.mockResolvedValue({
        status: 'failed',
        failureReason: 'Recipient unreachable',
      });
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      await orchestrator.updateTransmissionStatus('tx-1');

      expect(db.peppolTransmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Recipient unreachable',
          }),
        }),
      );
    });
  });

  describe('pollAndProcessInbound', () => {
    it('finds last transmission, polls ASP, processes new invoices, returns count', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findFirst
        .mockResolvedValueOnce({ createdAt: new Date('2026-04-01') }) // last inbound
        .mockResolvedValueOnce(null); // idempotency check in processInboundInvoice

      const asp = makeMockAspAdapter();
      asp.pollInboundInvoices.mockResolvedValue([
        {
          documentId: 'asp-new-1',
          xml: '<UBLInvoice/>',
          receivedAt: new Date('2026-04-02'),
          senderParticipantId: '0088:sender',
          receiverParticipantId: '0088:receiver',
        },
      ]);
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const count = await orchestrator.pollAndProcessInbound(ORG_ID);

      expect(count).toBe(1);
      expect(asp.pollInboundInvoices).toHaveBeenCalledWith(new Date('2026-04-01'));
      expect(db.invoice.create).toHaveBeenCalledOnce();
    });

    it('returns 0 when no new invoices from ASP', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findFirst.mockResolvedValue(null);
      const asp = makeMockAspAdapter();
      asp.pollInboundInvoices.mockResolvedValue([]);
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const count = await orchestrator.pollAndProcessInbound(ORG_ID);

      expect(count).toBe(0);
    });

    it('skips duplicates and returns only newly processed count', async () => {
      const db = makeMockDb();
      db.peppolTransmission.findFirst
        .mockResolvedValueOnce(null) // last inbound
        .mockResolvedValueOnce({ id: 'existing' }) // first payload is duplicate
        .mockResolvedValueOnce(null); // second payload is new

      const asp = makeMockAspAdapter();
      asp.pollInboundInvoices.mockResolvedValue([
        { documentId: 'dup-1', xml: '<a/>', receivedAt: new Date() },
        { documentId: 'new-1', xml: '<b/>', receivedAt: new Date() },
      ]);
      const orchestrator = new PeppolOrchestrator(asp as never, db as never);

      const count = await orchestrator.pollAndProcessInbound(ORG_ID);

      expect(count).toBe(1);
    });
  });
});
