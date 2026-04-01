import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { portalProcedure } from "../middleware/portal-auth.js";
import {
  triggerOcrExtraction,
  processOcrExtraction,
  getExtractionResult,
  getExtractionByDocument,
} from "../services/ocr-extraction.js";
import { prisma } from "@contractor-ops/db";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const triggerInput = z.object({
  documentId: z.string(),
  storageKey: z.string(),
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
    .use(requirePermission({ invoice: ["create"] }))
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      const result = await triggerOcrExtraction({
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        storageKey: input.storageKey,
        invoiceId: input.invoiceId,
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            result.error === "credits_exhausted"
              ? "OCR credits exhausted"
              : "No active subscription",
          cause: { reason: result.error, remaining: result.remaining },
        });
      }

      return result;
    }),

  /**
   * Get OCR extraction result by extraction ID.
   */
  getResult: tenantProcedure
    .input(getResultInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionResult({
        organizationId: ctx.organizationId,
        extractionId: input.extractionId,
      });

      return extraction ? plain(extraction) : null;
    }),

  /**
   * Get the latest OCR extraction for a document.
   */
  getByDocument: tenantProcedure
    .input(getByDocumentInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionByDocument({
        organizationId: ctx.organizationId,
        documentId: input.documentId,
      });

      return extraction ? plain(extraction) : null;
    }),

  /**
   * Retrigger OCR extraction for a previously processed document.
   * Creates a new OcrExtraction record and dispatches a new QStash job.
   */
  retrigger: tenantProcedure
    .use(requirePermission({ invoice: ["create"] }))
    .input(retriggerInput)
    .mutation(async ({ ctx, input }) => {
      // Find the existing extraction to get documentId and storageKey
      const existing = await prisma.ocrExtraction.findFirst({
        where: {
          id: input.extractionId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new Error("Extraction not found");
      }

      // Look up the document to get storageKey
      const document = await prisma.document.findFirst({
        where: {
          id: existing.documentId,
          organizationId: ctx.organizationId,
        },
        select: { storageKey: true },
      });

      if (!document?.storageKey) {
        throw new Error("Document or storage key not found");
      }

      // Create a new extraction for the same document
      const newExtraction = await prisma.ocrExtraction.create({
        data: {
          organizationId: ctx.organizationId,
          documentId: existing.documentId,
          invoiceId: existing.invoiceId,
          provider: "CLAUDE",
          status: "PENDING",
        },
      });

      // Dispatch QStash job
      const qstash = getQStashClient();
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/ocr/_process`,
        body: {
          extractionId: newExtraction.id,
          organizationId: ctx.organizationId,
          storageKey: document.storageKey,
        },
        retries: 2,
        timeout: "60s",
      });

      return { extractionId: newExtraction.id };
    }),

  // -------------------------------------------------------------------------
  // Portal endpoints (portalProcedure)
  // -------------------------------------------------------------------------

  /**
   * Trigger OCR extraction from the portal (contractor-initiated).
   */
  portalTrigger: portalProcedure
    .input(triggerInput)
    .mutation(async ({ ctx, input }) => {
      const result = await triggerOcrExtraction({
        organizationId: ctx.organizationId,
        documentId: input.documentId,
        storageKey: input.storageKey,
        invoiceId: input.invoiceId,
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            result.error === "credits_exhausted"
              ? "OCR credits exhausted"
              : "No active subscription",
          cause: { reason: result.error, remaining: result.remaining },
        });
      }

      return result;
    }),

  /**
   * Get OCR extraction result from the portal.
   */
  portalGetResult: portalProcedure
    .input(getResultInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionResult({
        organizationId: ctx.organizationId,
        extractionId: input.extractionId,
      });

      return extraction ? plain(extraction) : null;
    }),

  /**
   * Get latest OCR extraction for a document from the portal.
   */
  portalGetByDocument: portalProcedure
    .input(getByDocumentInput)
    .query(async ({ ctx, input }) => {
      const extraction = await getExtractionByDocument({
        organizationId: ctx.organizationId,
        documentId: input.documentId,
      });

      return extraction ? plain(extraction) : null;
    }),
});
