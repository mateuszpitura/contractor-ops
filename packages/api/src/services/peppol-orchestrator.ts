import type { PrismaClient } from '@contractor-ops/db';
import { prisma as defaultPrisma } from '@contractor-ops/db';
import type { ASPAdapter, InboundInvoicePayload } from '@contractor-ops/einvoice';
import {
  PeppolAEProfile,
  PeppolAEQRCode,
  PINT_AE_DOCUMENT_TYPE_ID,
} from '@contractor-ops/einvoice';
import { computeDuplicateCheckHash } from './invoice-matching.js';

// ---------------------------------------------------------------------------
// Peppol Orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates outbound and inbound Peppol invoice processing.
 *
 * Outbound: invoice -> generate PINT-AE XML -> transmit via ASP -> track status
 * Inbound: webhook/poll -> parse PINT-AE XML -> create Invoice with source PEPPOL
 */
export class PeppolOrchestrator {
  private readonly aspAdapter: ASPAdapter;
  private readonly db: PrismaClient;
  private readonly profile = new PeppolAEProfile();
  private readonly qrCode = new PeppolAEQRCode();

  constructor(aspAdapter: ASPAdapter, db?: PrismaClient) {
    this.aspAdapter = aspAdapter;
    this.db = db ?? (defaultPrisma as unknown as PrismaClient);
  }

  /**
   * Submit an outbound invoice to the Peppol network.
   *
   * Flow:
   * 1. Load invoice from DB (scoped to org)
   * 2. Validate org has active Peppol participant
   * 3. Generate PINT-AE XML via profile
   * 4. Create transmission record (PENDING)
   * 5. Transmit via ASP adapter
   * 6. Update transmission status
   */
  async submitOutboundInvoice(params: {
    organizationId: string;
    invoiceId: string;
    receiverParticipantId: string;
  }) {
    // Load invoice (tenant-isolated)
    const invoice = await this.db.invoice.findUniqueOrThrow({
      where: {
        id: params.invoiceId,
        organizationId: params.organizationId,
      },
      include: { lines: true },
    });

    // Load active participant
    const participant = await this.db.peppolParticipant.findFirst({
      where: {
        organizationId: params.organizationId,
        status: 'ACTIVE',
      },
    });

    if (!participant) {
      throw new Error('No active Peppol participant found for this organization');
    }

    // Generate PINT-AE XML using canonical EInvoice type
    const vatAmountMinor = invoice.vatAmountMinor ?? 0;
    const xml = await this.profile.generate({
      id: invoice.invoiceNumber,
      invoiceTypeCode: '380',
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      currencyCode: invoice.currency,
      supplier: {
        id: invoice.sellerTaxId ?? '',
        name: invoice.sellerName ?? '',
        country: 'AE',
      },
      customer: {
        id: invoice.buyerTaxId ?? '',
        name: '',
        country: 'AE',
      },
      lines: invoice.lines.map(line => ({
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity ? Number(line.quantity) : 1,
        unitPriceMinor: line.unitPriceMinor ?? 0,
        netAmountMinor: line.netAmountMinor ?? 0,
        vatRate: line.vatRate ?? '0',
        vatAmountMinor: line.vatAmountMinor ?? 0,
      })),
      taxExclusiveAmount: invoice.subtotalMinor,
      taxInclusiveAmount: invoice.totalMinor,
      payableAmount: invoice.amountToPayMinor,
      taxBreakdown: [
        {
          taxableAmountMinor: invoice.subtotalMinor,
          taxAmountMinor: vatAmountMinor,
          taxCategory: 'S',
          percent: invoice.vatRate ? parseFloat(invoice.vatRate) : 5,
        },
      ],
      profileId: 'peppol-ae',
      extensions: {
        buyerReference: invoice.externalInvoiceId ?? invoice.invoiceNumber,
      },
    });

    // Generate QR code for UAE FTA compliance (PEPPOL-04)
    const qrBuffer = await this.qrCode.generateQR({
      id: invoice.invoiceNumber,
      invoiceTypeCode: '380',
      issueDate: invoice.issueDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      currencyCode: invoice.currency,
      supplier: {
        id: invoice.sellerTaxId ?? '',
        name: invoice.sellerName ?? '',
        country: 'AE',
      },
      customer: {
        id: invoice.buyerTaxId ?? '',
        name: '',
        country: 'AE',
      },
      lines: [],
      taxExclusiveAmount: invoice.subtotalMinor,
      taxInclusiveAmount: invoice.totalMinor,
      payableAmount: invoice.amountToPayMinor,
      taxBreakdown: [
        {
          taxableAmountMinor: invoice.subtotalMinor,
          taxAmountMinor: vatAmountMinor,
          taxCategory: 'S',
        },
      ],
      profileId: 'peppol-ae',
    });
    const qrCodeBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

    // Persist QR code on the invoice record
    await this.db.invoice.update({
      where: { id: invoice.id },
      data: { qrCodeBase64 },
    });

    // Create transmission record
    const transmission = await this.db.peppolTransmission.create({
      data: {
        organizationId: params.organizationId,
        peppolParticipantId: participant.id,
        invoiceId: invoice.id,
        direction: 'OUTBOUND',
        status: 'PENDING',
        xmlPayload: xml,
        documentTypeId: PINT_AE_DOCUMENT_TYPE_ID,
      },
    });

    // Transmit via ASP
    try {
      const result = await this.aspAdapter.transmitInvoice({
        xml,
        senderParticipantId: participant.participantId,
        receiverParticipantId: params.receiverParticipantId,
        documentTypeId: PINT_AE_DOCUMENT_TYPE_ID,
      });

      if (result.status === 'rejected') {
        return this.db.peppolTransmission.update({
          where: { id: transmission.id },
          data: {
            status: 'REJECTED',
            errorMessage: result.errors?.map(e => `${e.code}: ${e.message}`).join('; '),
          },
        });
      }

      return this.db.peppolTransmission.update({
        where: { id: transmission.id },
        data: {
          status: 'TRANSMITTED',
          aspTransmissionId: result.transmissionId,
          transmittedAt: new Date(),
        },
      });
    } catch (error) {
      return this.db.peppolTransmission.update({
        where: { id: transmission.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Transmission failed',
        },
      });
    }
  }

  /**
   * Process an inbound invoice received via webhook or polling.
   *
   * Idempotent: skips if aspTransmissionId already exists.
   */
  async processInboundInvoice(params: { payload: InboundInvoicePayload; organizationId: string }) {
    // Idempotent — check for duplicate by ASP document ID
    const existing = await this.db.peppolTransmission.findFirst({
      where: { aspTransmissionId: params.payload.documentId },
    });

    if (existing) {
      return null; // Already processed
    }

    // Load active participant
    const participant = await this.db.peppolParticipant.findFirst({
      where: {
        organizationId: params.organizationId,
        status: { in: ['ACTIVE', 'REGISTERED', 'PENDING'] },
      },
    });

    if (!participant) {
      throw new Error('No Peppol participant found for this organization');
    }

    // Parse the XML to extract invoice data
    const parsed = await this.profile.parse(params.payload.xml);

    // Create transmission record
    const transmission = await this.db.peppolTransmission.create({
      data: {
        organizationId: params.organizationId,
        peppolParticipantId: participant.id,
        direction: 'INBOUND',
        status: 'DELIVERED',
        aspTransmissionId: params.payload.documentId,
        xmlPayload: params.payload.xml,
        deliveredAt: params.payload.receivedAt,
      },
    });

    // Create invoice from parsed EInvoice data
    const invoiceNumber = parsed.id || `PEPPOL-${params.payload.documentId}`;
    const invoice = await this.db.invoice.create({
      data: {
        organizationId: params.organizationId,
        invoiceNumber,
        source: 'PEPPOL',
        sourceReference: params.payload.documentId,
        issueDate: new Date(parsed.issueDate),
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : new Date(parsed.issueDate),
        currency: parsed.currencyCode || 'AED',
        subtotalMinor: parsed.taxExclusiveAmount,
        vatAmountMinor: parsed.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0),
        totalMinor: parsed.taxInclusiveAmount,
        amountToPayMinor: parsed.payableAmount,
        sellerName: parsed.supplier.name,
        sellerTaxId: parsed.supplier.id,
        buyerTaxId: parsed.customer.id,
        status: 'RECEIVED',
        matchStatus: 'UNMATCHED',
        duplicateCheckHash: computeDuplicateCheckHash(
          invoiceNumber,
          parsed.supplier.id,
          parsed.taxInclusiveAmount,
        ),
      },
    });

    return { transmission, invoice };
  }

  /**
   * Update the status of an outbound transmission by querying the ASP.
   */
  async updateTransmissionStatus(transmissionId: string) {
    const transmission = await this.db.peppolTransmission.findUniqueOrThrow({
      where: { id: transmissionId },
    });

    if (!transmission.aspTransmissionId) {
      return transmission;
    }

    const aspStatus = await this.aspAdapter.getTransmissionStatus(transmission.aspTransmissionId);

    const statusMap: Record<string, string> = {
      transmitted: 'TRANSMITTED',
      delivered: 'DELIVERED',
      failed: 'FAILED',
      pending: 'PENDING',
    };

    return this.db.peppolTransmission.update({
      where: { id: transmissionId },
      data: {
        status: (statusMap[aspStatus.status] ?? 'PENDING') as
          | 'PENDING'
          | 'TRANSMITTED'
          | 'DELIVERED'
          | 'FAILED'
          | 'REJECTED',
        deliveredAt: aspStatus.deliveredAt,
        errorMessage: aspStatus.failureReason,
      },
    });
  }

  /**
   * Poll for inbound invoices from the ASP and process any new ones.
   * Returns the count of newly processed invoices.
   */
  async pollAndProcessInbound(organizationId: string): Promise<number> {
    // Find last inbound transmission timestamp
    const lastInbound = await this.db.peppolTransmission.findFirst({
      where: {
        organizationId,
        direction: 'INBOUND',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const since = lastInbound?.createdAt ?? new Date(Date.now() - 86_400_000); // 24h ago

    const payloads = await this.aspAdapter.pollInboundInvoices(since);

    let processed = 0;
    for (const payload of payloads) {
      const result = await this.processInboundInvoice({
        payload,
        organizationId,
      });
      if (result) {
        processed++;
      }
    }

    return processed;
  }
}
