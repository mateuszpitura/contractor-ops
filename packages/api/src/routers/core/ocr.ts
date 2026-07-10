import { billingCreditDenialReason } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { portalSubjectRateLimitMiddleware } from '../../middleware/portal-rate-limit';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { requireTier } from '../../middleware/tier';
import {
  getExtractionByDocument,
  getExtractionResult,
  triggerOcrExtraction,
} from '../../services/ocr-extraction';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const triggerInput = z.object({
  documentId: z.string(),
  invoiceId: z.string().optional(),
});

const getResultInput = z.object({
  extractionId: z.string(),
});

const getByDocumentInput = z.object({
  documentId: z.string(),
});

const retriggerInput = z.object({
  extractionId: z.string(),
});

// ---------------------------------------------------------------------------
// OCR Router
// ---------------------------------------------------------------------------

export const ocrRouter = router({
  // -------------------------------------------------------------------------
  // Admin endpoints (tenantProcedure)
  // -------------------------------------------------------------------------

  /**
   * Trigger OCR extraction for a document.
   * Creates an OcrExtraction record and dispatches a QStash job.
   */
  trigger: tenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .use(requireTier('PRO'))
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      const result = await triggerOcrExtraction({
        db: ctx.db,
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        invoiceId: input.invoiceId,
      });

      if ('error' in result) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            result.error === billingCreditDenialReason.creditsExhausted
              ? 'OCR credits exhausted'
              : 'No active subscription',
          cause: { reason: result.error, remaining: result.remaining },
        });
      }

      return result;
    }),

  /**
   * Get OCR extraction result by extraction ID.
   */
  getResult: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(getResultInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionResult({
        organizationId: ctx.organizationId,
        extractionId: input.extractionId,
      });

      return extraction ? extraction : null;
    }),

  /**
   * Get the latest OCR extraction for a document.
   */
  getByDocument: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(getByDocumentInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionByDocument({
        organizationId: ctx.organizationId,
        documentId: input.documentId,
      });

      return extraction ? extraction : null;
    }),

  /**
   * Retrigger OCR extraction for a previously processed document.
   * Creates a new OcrExtraction record and dispatches a new QStash job.
   */
  retrigger: tenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .use(requireTier('PRO'))
    .input(retriggerInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.ocrExtraction.findFirst({
        where: {
          id: input.extractionId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.OCR_EXTRACTION_NOT_FOUND });
      }

      const result = await triggerOcrExtraction({
        db: ctx.db,
        organizationId: ctx.organizationId,
        documentId: existing.documentId,
        invoiceId: existing.invoiceId ?? undefined,
      });

      if ('error' in result) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            result.error === billingCreditDenialReason.creditsExhausted
              ? 'OCR credits exhausted'
              : 'No active subscription',
          cause: { reason: result.error, remaining: result.remaining },
        });
      }

      return { extractionId: result.extractionId };
    }),

  // -------------------------------------------------------------------------
  // Portal endpoints (portalProcedure)
  // -------------------------------------------------------------------------

  /**
   * Trigger OCR extraction from the portal (contractor-initiated).
   */
  portalTrigger: portalProcedure
    .use(portalSubjectRateLimitMiddleware)
    .use(requireTier('PRO'))
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      const result = await triggerOcrExtraction({
        db: ctx.db,
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        invoiceId: input.invoiceId,
      });

      if ('error' in result) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            result.error === billingCreditDenialReason.creditsExhausted
              ? 'OCR credits exhausted'
              : 'No active subscription',
          cause: { reason: result.error, remaining: result.remaining },
        });
      }

      return result;
    }),

  /**
   * Get OCR extraction result from the portal.
   */
  portalGetResult: portalProcedure.input(getResultInput).query(async ({ ctx, input }) => {
    const extraction = await getExtractionResult({
      organizationId: ctx.organizationId,
      extractionId: input.extractionId,
    });

    return extraction ? extraction : null;
  }),

  /**
   * Get latest OCR extraction for a document from the portal.
   */
  portalGetByDocument: portalProcedure.input(getByDocumentInput).query(async ({ ctx, input }) => {
    const extraction = await getExtractionByDocument({
      organizationId: ctx.organizationId,
      documentId: input.documentId,
    });

    return extraction ? extraction : null;
  }),
});
