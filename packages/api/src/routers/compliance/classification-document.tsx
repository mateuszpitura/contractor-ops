// Phase 59 · Plan 02 Task 2 — classificationDocument tRPC router (CLASS-03).
//
// Exposes three procedures:
//   - generateSds: renders an IR35 Status Determination Statement PDF, uploads
//     bytes to R2, persists a ClassificationDocument row (append-only, D-06),
//     returns a 300s signed URL. Rolls back R2 object on row-insert failure.
//   - getDownloadUrl: re-signs an existing document's pdfKey without re-upload
//     (D-05 byte stability).
//   - listByEngagement: lists documents for a ContractorAssignment via the
//     assessment join (ClassificationDocument.classificationAssessmentId ->
//     ClassificationAssessment.contractorAssignmentId).
//
// Plan 59-04 extends this router with `generateDrvDefenseBundle`.

import { createHash } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  CLASSIFICATION_ASSESSMENT_NOT_COMPLETED,
  CLASSIFICATION_ASSESSMENT_NOT_FOUND,
  CLASSIFICATION_ATTESTATION_REQUIRED,
  CLASSIFICATION_DOCUMENT_NOT_FOUND,
  CLASSIFICATION_DRV_BUNDLE_DE_ONLY,
  CLASSIFICATION_DRV_BUNDLE_NOT_COMPLETED,
  CLASSIFICATION_DRV_DE_ONLY,
  CLASSIFICATION_GENERATE_SDS_IR35_ONLY,
  FILE_SIZE_MISMATCH,
  MIME_MAGIC_BYTE_MISMATCH,
  R2_UPLOAD_FAILED,
  SDS_NOT_APPROVED,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { classificationProcedure } from '../../middleware/require-classification-flag';
import { buildClassificationDocumentKey } from '../../services/classification-document-keys';
import { requestExport } from '../../services/exports/index';
import { deleteObject, putObjectAndSignDownload, signExistingDownload } from '../../services/r2';

const PDF_TTL_SECONDS = 300;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const generateSdsInputSchema = z.object({
  classificationAssessmentId: z.string().min(1),
});

const getDownloadUrlInputSchema = z.object({
  classificationDocumentId: z.string().min(1),
});

// Phase 64 D-26 — DRV decision letter upload schema
const uploadDrvDecisionLetterInputSchema = z.object({
  classificationAssessmentId: z.string().min(1),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024), // 10MB cap
});

const listByEngagementInputSchema = z.object({
  contractorAssignmentId: z.string().min(1),
});

const generateDrvDefenseBundleInputSchema = z.object({
  classificationAssessmentId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const classificationDocumentRouter = router({
  /**
   * Enqueue an SDS PDF generation job (P2-F · F-SCALE-02).
   *
   * The mutation only enforces the legal preconditions (assessment
   * completed + outcome.kind === 'IR35' + SdsApproval present) and
   * confirms the assessment exists in the caller's tenant. The actual
   * React-PDF render + R2 upload happens in the QStash consumer at
   * `/api/exports/_process` to keep the request path bounded — the prior
   * synchronous render allocated 30-150 MB per request and OOM'd the pod
   * under burst.
   *
   * Returns `{ exportId, status: 'PENDING' }` immediately. The client
   * polls `/api/exports/:exportId/download` (or waits for the
   * "your export is ready" email).
   */
  generateSds: classificationProcedure
    .input(generateSdsInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Preconditions (kept in the mutation so the user gets immediate
      // feedback rather than a delayed FAILED export).
      const assessment = await ctx.db.classificationAssessment
        .findUniqueOrThrow({
          where: { id: input.classificationAssessmentId },
          select: {
            id: true,
            status: true,
            questionsSnapshot: true,
            outcome: true,
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: CLASSIFICATION_ASSESSMENT_NOT_FOUND,
          });
        });

      if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_ASSESSMENT_NOT_COMPLETED,
        });
      }
      const outcome = assessment.outcome as { kind?: string } | null;
      if (!outcome || outcome.kind !== 'IR35') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_GENERATE_SDS_IR35_ONLY,
        });
      }

      // Phase 64 D-22 — Require SdsApproval before generating SDS (LEGAL-05)
      const sdsApproval = await ctx.db.sdsApproval.findUnique({
        where: { assessmentId: input.classificationAssessmentId },
        select: { id: true },
      });
      if (!sdsApproval) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: SDS_NOT_APPROVED,
        });
      }

      const result = await requestExport({
        organizationId: ctx.organizationId,
        requestedByUserId: ctx.session.user.id,
        type: 'classification-document-sds',
        params: { classificationAssessmentId: input.classificationAssessmentId },
      });

      return result;
    }),

  /**
   * Enqueue a DRV defense bundle PDF generation job (P2-F · F-SCALE-02).
   *
   * Same async contract as `generateSds` — the mutation only validates
   * the legal preconditions (completed Schein assessment + signed
   * attestation); the React-PDF render + R2 upload happens off the
   * request path.
   */
  generateDrvDefenseBundle: classificationProcedure
    .input(generateDrvDefenseBundleInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const assessment = await ctx.db.classificationAssessment
        .findUniqueOrThrow({
          where: { id: input.classificationAssessmentId },
          select: {
            id: true,
            status: true,
            questionsSnapshot: true,
            outcome: true,
            contractorAssignmentId: true,
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: CLASSIFICATION_ASSESSMENT_NOT_FOUND,
          });
        });

      if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_DRV_BUNDLE_NOT_COMPLETED,
        });
      }
      const outcome = assessment.outcome as { kind?: string } | null;
      if (!outcome || outcome.kind !== 'SCHEINSELBSTANDIGKEIT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_DRV_BUNDLE_DE_ONLY,
        });
      }

      const attestation = await ctx.db.ir35OtherClientAttestation.findUnique({
        where: { contractorAssignmentId: assessment.contractorAssignmentId },
        select: { signedAt: true },
      });
      if (!attestation?.signedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_ATTESTATION_REQUIRED,
        });
      }

      const result = await requestExport({
        organizationId: ctx.organizationId,
        requestedByUserId: ctx.session.user.id,
        type: 'drv-defense-bundle',
        params: { classificationAssessmentId: input.classificationAssessmentId },
      });

      return result;
    }),

  /**
   * Re-sign an existing ClassificationDocument for download. Does NOT
   * re-upload — bytes remain byte-exact (D-05).
   */
  getDownloadUrl: classificationProcedure
    .input(getDownloadUrlInputSchema)
    .query(async ({ input, ctx }) => {
      const doc = await ctx.db.classificationDocument
        .findUniqueOrThrow({
          where: { id: input.classificationDocumentId },
          include: {
            classificationAssessment: {
              include: {
                contractorAssignment: { include: { contractor: true } },
              },
            },
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: CLASSIFICATION_DOCUMENT_NOT_FOUND,
          });
        });

      const contractorName =
        doc.classificationAssessment.contractorAssignment.contractor.displayName;
      const kindLabel = doc.kind === 'SDS' ? 'SDS' : 'DRV-Defense';
      const downloadFilename = sanitizeFilename(`${kindLabel}-${contractorName}.pdf`);

      const { signedUrl, expiresInSeconds } = await signExistingDownload(
        doc.pdfKey,
        PDF_TTL_SECONDS,
        downloadFilename,
      );

      return {
        url: signedUrl,
        expiresInSeconds,
        kind: doc.kind,
        generatedAt: doc.generatedAt,
        byteSize: doc.byteSize,
        sha256Hash: doc.sha256Hash,
      };
    }),

  /**
   * List ClassificationDocument rows for a ContractorAssignment via the
   * ClassificationAssessment join. Newest first. Tenant scope is enforced
   * by the Prisma client extension + explicit contractorAssignmentId filter.
   */
  listByEngagement: classificationProcedure
    .input(listByEngagementInputSchema)
    .query(async ({ input, ctx }) => {
      const docs = await ctx.db.classificationDocument.findMany({
        where: {
          classificationAssessment: {
            contractorAssignmentId: input.contractorAssignmentId,
          },
        },
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          kind: true,
          generatedAt: true,
          byteSize: true,
          rendererVersion: true,
          ruleSetVersion: true,
          sha256Hash: true,
        },
      });
      return docs;
    }),

  // ---------------------------------------------------------------------------
  // Phase 64 · LEGAL-06 — uploadDrvDecisionLetter (D-26)
  // ---------------------------------------------------------------------------

  /**
   * Upload a DRV Statusfeststellungsverfahren decision letter.
   * Creates a ClassificationDocument row with kind=DRV_DECISION_LETTER.
   * File cap: 10MB. Accepted types: PDF, JPEG, PNG.
   * Content-addressed R2 with 300s signed download URL.
   */
  uploadDrvDecisionLetter: classificationProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(uploadDrvDecisionLetterInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const userId = ctx.session.user.id;

      const assessment = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.classificationAssessmentId },
            select: { id: true, countryCode: true },
          }),
        'Assessment not found',
      );
      if (assessment.countryCode !== 'DE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: CLASSIFICATION_DRV_DE_ONLY,
        });
      }

      const fileBuffer = Buffer.from(input.fileBase64, 'base64');
      if (fileBuffer.byteLength !== input.fileSizeBytes) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: FILE_SIZE_MISMATCH });
      }

      // Magic byte validation
      const magicBytes = fileBuffer.slice(0, 4);
      const isPdf = magicBytes.toString('hex').startsWith('25504446'); // %PDF
      const isJpeg = magicBytes.slice(0, 2).toString('hex') === 'ffd8';
      const isPng = magicBytes.toString('hex') === '89504e47';
      const mimeValid =
        (input.mimeType === 'application/pdf' && isPdf) ||
        (input.mimeType === 'image/jpeg' && isJpeg) ||
        (input.mimeType === 'image/png' && isPng);
      if (!mimeValid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: MIME_MAGIC_BYTE_MISMATCH });
      }

      const sha256Hash = createHash('sha256').update(fileBuffer).digest('hex');
      const r2Key = buildClassificationDocumentKey({
        organizationId: ctx.organizationId,
        classificationAssessmentId: input.classificationAssessmentId,
        kind: 'DRV_DECISION_LETTER',
        ruleSetVersion: 'user-upload',
        sha256: sha256Hash,
      });

      let signedUrl: string;
      try {
        const result = await putObjectAndSignDownload({
          key: r2Key,
          body: fileBuffer,
          contentType: input.mimeType,
          ttlSeconds: PDF_TTL_SECONDS,
        });
        signedUrl = result.signedUrl;
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: R2_UPLOAD_FAILED });
      }

      let doc: { id: string };
      try {
        doc = await ctx.db.classificationDocument.create({
          data: {
            organizationId: ctx.organizationId,
            classificationAssessmentId: input.classificationAssessmentId,
            kind: 'DRV_DECISION_LETTER',
            pdfKey: r2Key,
            sha256Hash,
            byteSize: fileBuffer.byteLength,
            rendererVersion: 'user-upload',
            ruleSetVersion: 'N/A',
            generatedByUserId: userId,
          },
          select: { id: true },
        });
      } catch (err) {
        // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
        await deleteObject(r2Key).catch(() => undefined);
        throw err;
      }

      return { documentId: doc.id, downloadUrl: signedUrl };
    }),
});
