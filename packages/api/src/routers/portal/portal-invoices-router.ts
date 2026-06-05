import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { consumePendingUpload, createPendingUpload } from '../../services/pending-upload';
import { createRegionalPresignedDownloadUrl } from '../../services/regional-storage';
import type { ActivityEntry } from './portal-shared';

export const portalInvoicesRouter = router({
  /**
   * List contractor's invoices with status info.
   */
  listInvoices: portalProcedure.query(async ({ ctx }) => {
    const invoices = await ctx.db.invoice.findMany({
      where: { contractorId: ctx.contractorId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        contractId: true,
        totalMinor: true,
        currency: true,
        issueDate: true,
        receivedAt: true,
        status: true,
        matchStatus: true,
        approvalStatus: true,
        paymentStatus: true,
        paidAt: true,
        contract: { select: { title: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return invoices;
  }),

  /**
   * Get invoice detail with timeline, attached files, and payment info.
   * Excludes internal data (batch IDs, reviewer names, cost centers) per D-11/D-12.
   */
  getInvoice: portalProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const invoice = await ctx.db.invoice.findFirst({
      where: { id: input.id, contractorId: ctx.contractorId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        subtotalMinor: true,
        totalMinor: true,
        currency: true,
        status: true,
        approvalStatus: true,
        paymentStatus: true,
        receivedAt: true,
        reviewedAt: true,
        approvedAt: true,
        paidAt: true,
        rejectedAt: true,
        rejectionReason: true,
        contract: { select: { id: true, title: true } },
        files: {
          include: {
            document: {
              select: { id: true, originalFileName: true, storageKey: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Generate download URLs for attached files
    const files = await Promise.all(
      invoice.files.map(async f => {
        const downloadUrl = await createRegionalPresignedDownloadUrl(f.document.storageKey);
        return {
          id: f.document.id,
          name: f.document.originalFileName,
          downloadUrl,
        };
      }),
    );

    // Payment info (date + amount only, no batch IDs per D-12)
    const paymentItem = await ctx.db.paymentRunItem.findFirst({
      where: {
        invoiceId: input.id,
        contractorId: ctx.contractorId,
        status: 'PAID',
      },
      select: {
        markedPaidAt: true,
        amountMinor: true,
        currency: true,
      },
    });

    const payment = paymentItem
      ? {
          paidAt: paymentItem.markedPaidAt,
          amountMinor: paymentItem.amountMinor,
          currency: paymentItem.currency,
        }
      : null;

    // Build activity log from timestamps (contractor-visible events only)
    const activityLog: ActivityEntry[] = [];

    if (invoice.receivedAt) {
      activityLog.push({
        timestamp: invoice.receivedAt,
        event: 'Invoice submitted',
      });
    }
    if (invoice.reviewedAt) {
      activityLog.push({
        timestamp: invoice.reviewedAt,
        event: 'Under review',
      });
    }
    if (invoice.approvedAt) {
      activityLog.push({
        timestamp: invoice.approvedAt,
        event: 'Invoice approved',
      });
    }
    if (invoice.rejectedAt) {
      activityLog.push({
        timestamp: invoice.rejectedAt,
        event: 'Invoice rejected',
        detail: invoice.rejectionReason,
      });
    }
    if (invoice.paidAt) {
      activityLog.push({
        timestamp: invoice.paidAt,
        event: 'Payment completed',
      });
    }

    // Sort chronologically
    activityLog.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Exclude internal data from response
    const {
      files: _files,
      receivedAt: _receivedAt,
      reviewedAt: _reviewedAt,
      approvedAt: _approvedAt,
      paidAt: _paidAt,
      rejectedAt: _rejectedAt,
      rejectionReason: _rejectionReason,
      ...invoiceData
    } = invoice;

    return {
      ...invoiceData,
      files,
      payment,
      activityLog,
    };
  }),

  /**
   * List completed payments for this contractor.
   * Returns only paidAt + amount + currency + invoiceNumber (no batch IDs per D-12).
   */
  listPayments: portalProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.paymentRunItem.findMany({
      where: {
        contractorId: ctx.contractorId,
        status: 'PAID',
      },
      select: {
        id: true,
        invoiceId: true,
        amountMinor: true,
        currency: true,
        markedPaidAt: true,
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { markedPaidAt: 'desc' },
    });

    return items.map(item => ({
      id: item.id,
      invoiceId: item.invoiceId,
      invoiceNumber: item.invoice.invoiceNumber,
      amountMinor: item.amountMinor,
      currency: item.currency,
      paidAt: item.markedPaidAt,
    }));
  }),

  /**
   * Get a presigned upload URL for invoice PDF upload.
   * Only PDF files are accepted.
   */
  getUploadUrl: portalProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string().refine(ct => ct === 'application/pdf', 'Only PDF files'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // F-SEC-01: never accept (or return) a client-supplied storage key.
      // The server derives the key from `(organizationId, documentId)` and
      // persists it in `PendingUpload` for retrieval by `submitInvoice`.
      // The client only ever sees `documentId` + the presigned PUT URL —
      // the storage path stays inside the trust boundary.
      const pending = await createPendingUpload({
        db: ctx.db,
        organizationId: ctx.organizationId,
        purpose: 'PORTAL_INVOICE_SUBMIT',
        filename: input.filename,
        mimeType: input.contentType,
      });

      return {
        uploadUrl: pending.presignedPutUrl,
        documentId: pending.documentId,
        expiresAt: pending.expiresAt,
        // F-SEC-01: kept as deprecated empty string for back-compat with
        // older portal clients that still destructure `storageKey`. New
        // clients should ignore this field — the server no longer trusts it.
        storageKey: '',
      };
    }),

  /**
   * Submit an invoice through the portal.
   * Creates invoice with source PORTAL and status RECEIVED.
   * Verifies contract belongs to this contractor and is ACTIVE.
   */
  submitInvoice: portalProcedure
    .input(
      z.object({
        contractId: z.string(),
        invoiceNumber: z.string().min(1).max(100),
        issueDate: z.date(),
        dueDate: z.date(),
        netAmountMinor: z.number().int().positive(),
        grossAmountMinor: z.number().int().positive(),
        documentId: z.string(),
        // F-SEC-01: `storageKey` is intentionally NOT part of the input
        // contract — the server recovers the trusted key from `PendingUpload`
        // (consumed atomically below). Older portal clients that still send
        // `storageKey` are non-breaking: Zod's default object behaviour
        // strips unknown keys, so the field is silently dropped at the edge.
        // Re-introducing it here would re-open F-SEC-01 (cross-tenant IDOR
        // via attacker-supplied storage path).
        originalFileName: z.string(),
        fileSizeBytes: z.number().int().positive(),
        checksumSha256: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify contract belongs to this contractor and is ACTIVE
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.contractId,
          contractorId: ctx.contractorId,
          status: 'ACTIVE',
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PORTAL_CONTRACT_NOT_FOUND,
        });
      }

      // F-SEC-01: atomically consume the PendingUpload row to recover the
      // server-stored `storageKey` for this `documentId`. Throws if the row
      // is missing, expired, already consumed, belongs to another tenant,
      // or was minted for a different purpose. THIS IS THE PRIMARY DEFENCE
      // against cross-tenant document exfiltration via portal.submitInvoice.
      const pending = await consumePendingUpload({
        db: ctx.db,
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        expectedPurpose: 'PORTAL_INVOICE_SUBMIT',
      });

      // Create document record for the uploaded PDF using the server-trusted
      // storage key recovered from `PendingUpload`. The input schema does not
      // expose `storageKey` — there is no client-supplied path to fall back to.
      await ctx.db.document.create({
        data: {
          id: input.documentId,
          organizationId: ctx.organizationId,
          storageKey: pending.storageKey,
          originalFileName: input.originalFileName,
          mimeType: pending.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          documentType: 'INVOICE',
          source: 'USER_UPLOAD',
          checksumSha256: input.checksumSha256 ?? '',
        },
      });

      // Create invoice with PORTAL source
      const invoice = await ctx.db.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: ctx.contractorId,
          contractId: input.contractId,
          invoiceNumber: input.invoiceNumber,
          source: 'PORTAL',
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          subtotalMinor: input.netAmountMinor,
          totalMinor: input.grossAmountMinor,
          amountToPayMinor: input.grossAmountMinor,
          currency: contract.currency,
          status: 'RECEIVED',
          matchStatus: 'UNMATCHED',
          approvalStatus: 'NOT_STARTED',
          paymentStatus: 'NOT_READY',
          submittedByEmail: ctx.portalSession.email,
        },
      });

      // Link document to invoice
      await ctx.db.invoiceFile.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: invoice.id,
          documentId: input.documentId,
          role: 'SOURCE_ORIGINAL',
        },
      });

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      };
    }),

  /**
   * Get active contracts for invoice form dropdown.
   */
  getActiveContracts: portalProcedure.query(async ({ ctx }) => {
    const contracts = await ctx.db.contract.findMany({
      where: { contractorId: ctx.contractorId, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        currency: true,
        rateValueMinor: true,
        rateType: true,
        billingModel: true,
      },
    });

    return contracts;
  }),
});
