// packages/api/src/routers/invoice-intake.ts
//
// Phase 62 · Plan 62-05 Task 1 — tRPC surface for the inbound e-invoice
// intake pipeline (EINV-03, D-09, D-12).
//
// Every procedure is:
//   - tenantProcedure-gated (auth + organization scope set via AsyncLocalStorage),
//   - RBAC-guarded via `requirePermission`,
//   - Zod-validated at the boundary, and
//   - defensively org-scoped — cross-tenant accesses resolve to NOT_FOUND
//     (not FORBIDDEN) to avoid the response-code oracle pattern.
//
// The `upload` procedure is additionally rate-limited to ≤10 uploads per
// user per minute via `uploadRateLimitMiddleware`.
//
// Service errors surface as typed POJOs `{ code, message, details? }` from
// `invoice-intake-service.ts`. We translate each `code` to the appropriate
// tRPC error code at the boundary.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  CII_XSD_INVALID,
  DUPLICATE_INVOICE_NUMBER,
  FILE_TOO_LARGE,
  INTAKE_INTERNAL_ERROR,
  INVALID_STATE_TRANSITION,
  INVOICE_NOT_FOUND,
  REASON_TOO_SHORT,
  UNSUPPORTED_MIME,
  VALIDATION_NOT_REQUIRED,
} from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByExtraRowUndefined } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { uploadRateLimitMiddleware } from '../../middleware/upload-rate-limit';
import type { MatchCandidate } from '../../services/invoice-intake-matcher';
import { rankIntakeCandidates } from '../../services/invoice-intake-matcher';
import type { IntakeServiceErrorCode, UploadResult } from '../../services/invoice-intake-service';
import {
  acknowledgeValidation as svcAcknowledgeValidation,
  confirmMatch as svcConfirmMatch,
  convertToInvoice as svcConvertToInvoice,
  reject as svcReject,
  uploadAndPersist,
} from '../../services/invoice-intake-service';
import { signExistingDownload } from '../../services/r2';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const intakeIdInput = z.object({ intakeId: z.cuid() });

const listStatusValues = ['PARSED', 'NEEDS_REVIEW', 'MATCHED', 'CONVERTED', 'REJECTED'] as const;

const listByOrgInput = z.object({
  status: z.enum(listStatusValues).optional(),
  cursor: z.cuid().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

// Upload ceiling in decoded bytes is enforced in the service; here we cap
// the base64 input length as a cheap pre-filter. A 5 MiB binary becomes
// ~6.99 MiB base64, so 7_000_000 chars is a tight upper bound.
const uploadInput = z.object({
  fileKind: z.enum(['xml', 'pdf']),
  fileBase64: z.string().min(1).max(7_000_000),
  mime: z.string().max(64),
  originalFilename: z.string().max(255),
});

const confirmMatchInput = intakeIdInput.extend({
  contractorId: z.cuid(),
  contractId: z.cuid().optional(),
});

const rejectInput = intakeIdInput.extend({
  reason: z.string().min(3).max(500),
});

// ---------------------------------------------------------------------------
// Typed service error → TRPCError translator
// ---------------------------------------------------------------------------

/**
 * Duck-type guard for typed POJO errors thrown by the intake service.
 * The service throws `{ code, message, details? }`; anything else bubbles.
 */
function isIntakeServiceError(
  err: unknown,
): err is { code: IntakeServiceErrorCode; message: string; details?: unknown } {
  if (err === null || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return (
    code === 'FILE_TOO_LARGE' ||
    code === 'UNSUPPORTED_MIME' ||
    code === 'CII_XSD_INVALID' ||
    code === 'INVALID_STATE_TRANSITION' ||
    code === 'NOT_FOUND' ||
    code === 'VALIDATION_NOT_REQUIRED' ||
    code === 'REASON_TOO_SHORT' ||
    code === 'DUPLICATE_INVOICE_NUMBER'
  );
}

/**
 * Duck-type guard for typed POJO errors thrown by the einvoice parser /
 * validator (ZUGFeRD_*, CII_*, etc). The parser throws
 * `{ code: string, ... }` shapes without an Error prototype.
 */
function hasStringCode(err: unknown): err is { code: string; message?: string } {
  if (err === null || typeof err !== 'object') return false;
  return typeof (err as { code?: unknown }).code === 'string';
}

function mapIntakeErrorToTrpc(err: unknown): TRPCError {
  if (isIntakeServiceError(err)) {
    switch (err.code) {
      case 'FILE_TOO_LARGE':
        return new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: FILE_TOO_LARGE,
        });
      case 'UNSUPPORTED_MIME':
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: UNSUPPORTED_MIME,
        });
      case 'CII_XSD_INVALID':
        return new TRPCError({
          code: 'UNPROCESSABLE_CONTENT',
          message: CII_XSD_INVALID,
        });
      case 'INVALID_STATE_TRANSITION':
        return new TRPCError({
          code: 'CONFLICT',
          message: INVALID_STATE_TRANSITION,
        });
      case 'NOT_FOUND':
        return new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      case 'VALIDATION_NOT_REQUIRED':
        return new TRPCError({
          code: 'CONFLICT',
          message: VALIDATION_NOT_REQUIRED,
        });
      case 'REASON_TOO_SHORT':
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: REASON_TOO_SHORT,
        });
      case 'DUPLICATE_INVOICE_NUMBER':
        return new TRPCError({
          code: 'CONFLICT',
          message: DUPLICATE_INVOICE_NUMBER,
        });
    }
  }

  if (hasStringCode(err)) {
    // Parser / validator typed errors (see packages/einvoice parsers).
    switch (err.code) {
      case 'CII_XSD_INVALID':
      case 'CII_PARSE_FAILED':
      case 'ZUGFERD_NO_XML_ATTACHMENT':
      case 'ZUGFERD_PDF_UNREADABLE':
      case 'ZUGFERD_LEVEL_UNSUPPORTED':
        return new TRPCError({
          code: 'UNPROCESSABLE_CONTENT',
          message: err.code,
        });
    }
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: INTAKE_INTERNAL_ERROR,
  });
}

// ---------------------------------------------------------------------------
// Org-scoped intake loader
// ---------------------------------------------------------------------------

type IntakeRowSummary = {
  id: string;
  organizationId: string;
  rawFileKey: string | null;
  extractedXmlKey: string | null;
  validationReportKey: string | null;
  sourceKind: string;
};

async function loadIntakeScoped(
  db: { invoiceIntakeRequest: { findFirst: (args: unknown) => Promise<unknown> } },
  intakeId: string,
  organizationId: string,
): Promise<IntakeRowSummary | null> {
  // F-DB-22 — pre-filter on (id, organizationId) instead of fetch-and-check.
  // Closes the timing-oracle (cross-org findUnique was slightly slower than
  // a non-existent id) and removes the fragile post-fetch guard.
  return (await (db.invoiceIntakeRequest.findFirst as (args: unknown) => Promise<unknown>)({
    where: { id: intakeId, organizationId },
    select: {
      id: true,
      organizationId: true,
      rawFileKey: true,
      extractedXmlKey: true,
      validationReportKey: true,
      sourceKind: true,
    },
  })) as IntakeRowSummary | null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const invoiceIntakeRouter = router({
  /**
   * Upload an inbound XRechnung XML or ZUGFeRD PDF. Validates size / MIME,
   * dedups by SHA-256 content hash, parses + KoSIT-validates, persists an
   * `InvoiceIntakeRequest` row and uploads raw + extracted XML + report to
   * R2. Rate-limited to 10 uploads per user per minute.
   *
   * The service throws typed errors on gate failures; we translate each
   * `code` to the appropriate tRPC error code.
   *
   * NEVER logs the input payload — it can contain base64 file bytes and
   * PII-bearing supplier metadata.
   */
  upload: tenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .use(uploadRateLimitMiddleware)
    .input(uploadInput)
    .mutation(async ({ ctx, input }): Promise<UploadResult> => {
      const log = createLogger({
        module: 'invoice-intake-router',
        procedure: 'upload',
        orgId: ctx.organizationId,
      });
      try {
        return await uploadAndPersist(ctx.db as never, {
          orgId: ctx.organizationId,
          userId: ctx.user?.id ?? '',
          fileKind: input.fileKind,
          fileBase64: input.fileBase64,
          mime: input.mime,
          originalFilename: input.originalFilename,
        });
      } catch (err) {
        const trpcErr = mapIntakeErrorToTrpc(err);
        if (trpcErr.code === 'INTERNAL_SERVER_ERROR') {
          log.error({ err: err instanceof Error ? err.message : String(err) }, 'upload failed');
        }
        throw trpcErr;
      }
    }),

  /**
   * Cursor-paginated list of intake rows for the caller's organization,
   * optionally filtered by status.
   */
  listByOrg: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(listByOrgInput)
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
      };
      if (input.status) where.status = input.status;

      // Stable cursor pagination needs a deterministic tiebreaker: createdAt
      // has millisecond resolution and two rows created in the same tick
      // would otherwise flicker across page boundaries. Order + cursor on
      // id so the cursor unambiguously picks a single row.
      const rows = (await (
        ctx.db.invoiceIntakeRequest.findMany as (args: unknown) => Promise<unknown>
      )({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...cursorClause(input),
      })) as Array<{ id: string }>;

      return paginateByExtraRowUndefined(rows, input);
    }),

  /**
   * Load a single intake row by id (org-scoped).
   * Cross-org access returns NOT_FOUND — never FORBIDDEN.
   */
  getById: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(intakeIdInput)
    .query(async ({ ctx, input }) => {
      // F-DB-22 — pre-filter org-scope in the where clause.
      const row = (await (
        ctx.db.invoiceIntakeRequest.findFirst as (args: unknown) => Promise<unknown>
      )({
        where: { id: input.intakeId, organizationId: ctx.organizationId },
      })) as Record<string, unknown> | null;
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }
      return row as unknown;
    }),

  /**
   * Rank contractor candidates for a given intake. Read-only — the
   * candidate list is never persisted.
   */
  getMatchCandidates: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(intakeIdInput)
    .query(async ({ ctx, input }): Promise<MatchCandidate[]> => {
      // F-DB-22 — pre-filter org-scope in the where clause.
      const intake = (await (
        ctx.db.invoiceIntakeRequest.findFirst as (args: unknown) => Promise<unknown>
      )({
        where: { id: input.intakeId, organizationId: ctx.organizationId },
        select: {
          extractedSupplierName: true,
          extractedSupplierVatId: true,
          extractedSupplierLeitwegId: true,
        },
      })) as {
        extractedSupplierName: string | null;
        extractedSupplierVatId: string | null;
        extractedSupplierLeitwegId: string | null;
      } | null;

      if (!intake) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }

      return rankIntakeCandidates(ctx.db as never, ctx.organizationId, {
        supplierName: intake.extractedSupplierName ?? '',
        supplierVatId: intake.extractedSupplierVatId,
        supplierLeitwegId: intake.extractedSupplierLeitwegId,
      });
    }),

  /**
   * Confirm the contractor/contract match for an intake. Advances status
   * to MATCHED.
   */
  confirmMatch: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(confirmMatchInput)
    .mutation(async ({ ctx, input }): Promise<void> => {
      try {
        await svcConfirmMatch(ctx.db as never, {
          orgId: ctx.organizationId,
          intakeId: input.intakeId,
          contractorId: input.contractorId,
          contractId: input.contractId,
        });
      } catch (err) {
        throw mapIntakeErrorToTrpc(err);
      }
    }),

  /**
   * Record a human acknowledgement of a WARNINGS / INVALID intake before
   * it can be converted. Refuses VALID rows (nothing to sign off).
   */
  acknowledgeValidation: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(intakeIdInput)
    .mutation(async ({ ctx, input }): Promise<void> => {
      try {
        await svcAcknowledgeValidation(ctx.db as never, {
          orgId: ctx.organizationId,
          intakeId: input.intakeId,
          userId: ctx.user?.id ?? '',
        });
      } catch (err) {
        throw mapIntakeErrorToTrpc(err);
      }
    }),

  /**
   * Promote a MATCHED intake into a real Invoice row. Idempotent — a
   * second call returns the same invoiceId.
   */
  convertToInvoice: tenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .input(intakeIdInput)
    .mutation(async ({ ctx, input }): Promise<{ invoiceId: string }> => {
      try {
        return await svcConvertToInvoice(ctx.db as never, {
          orgId: ctx.organizationId,
          intakeId: input.intakeId,
          userId: ctx.user?.id ?? '',
        });
      } catch (err) {
        throw mapIntakeErrorToTrpc(err);
      }
    }),

  /**
   * Close an intake with a human-supplied reason. Blocked once the intake
   * is CONVERTED.
   */
  reject: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(rejectInput)
    .mutation(async ({ ctx, input }): Promise<void> => {
      try {
        await svcReject(ctx.db as never, {
          orgId: ctx.organizationId,
          intakeId: input.intakeId,
          userId: ctx.user?.id ?? '',
          reason: input.reason,
        });
      } catch (err) {
        throw mapIntakeErrorToTrpc(err);
      }
    }),

  /**
   * Signed 300-second download URL for the raw uploaded file (PDF or XML).
   */
  downloadRawFile: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(intakeIdInput)
    .query(async ({ ctx, input }) => {
      const intake = await loadIntakeScoped(ctx.db as never, input.intakeId, ctx.organizationId);
      if (!intake?.rawFileKey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }
      const { signedUrl, expiresInSeconds } = await signExistingDownload(intake.rawFileKey, 300);
      return { url: signedUrl, expiresInSeconds };
    }),

  /**
   * Signed 300-second download URL for the extracted CII XML (for PDF
   * uploads) or the raw file itself (for XML uploads). D-16.
   */
  downloadExtractedXml: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(intakeIdInput)
    .query(async ({ ctx, input }) => {
      const intake = await loadIntakeScoped(ctx.db as never, input.intakeId, ctx.organizationId);
      if (!intake) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }
      const key = intake.extractedXmlKey ?? intake.rawFileKey;
      if (!key) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }
      const { signedUrl, expiresInSeconds } = await signExistingDownload(key, 300);
      return { url: signedUrl, expiresInSeconds };
    }),

  /**
   * Signed 300-second download URL for the KoSIT validation report.
   * Returns null when no report was persisted (e.g. dedup re-upload).
   */
  downloadValidationReport: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(intakeIdInput)
    .query(async ({ ctx, input }) => {
      const intake = await loadIntakeScoped(ctx.db as never, input.intakeId, ctx.organizationId);
      if (!intake) {
        throw new TRPCError({ code: 'NOT_FOUND', message: INVOICE_NOT_FOUND });
      }
      if (!intake.validationReportKey) return null;
      const { signedUrl, expiresInSeconds } = await signExistingDownload(
        intake.validationReportKey,
        300,
      );
      return { url: signedUrl, expiresInSeconds };
    }),
});
