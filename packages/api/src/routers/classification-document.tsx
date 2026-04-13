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

import { renderToBuffer } from '@react-pdf/renderer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '../init.js';
import { tenantProcedure } from '../middleware/tenant.js';
import {
  DRVDefenseBundleDocument,
  RENDERER_SLUG as DRV_RENDERER_SLUG,
  TEMPLATE_VERSION as DRV_TEMPLATE_VERSION,
} from '../pdf-templates/drv-defense-bundle.js';
import {
  IR35SDSDocument,
  RENDERER_SLUG as SDS_RENDERER_SLUG,
  TEMPLATE_VERSION as SDS_TEMPLATE_VERSION,
} from '../pdf-templates/ir35-sds.js';
import { buildClassificationDocumentKey } from '../services/classification-document-keys.js';
import { deleteObject, putObjectAndSignDownload, signExistingDownload } from '../services/r2.js';

// Bump on @react-pdf/renderer upgrade. Embedded into
// ClassificationDocument.rendererVersion for audit forensics (D-09).
const REACT_PDF_VERSION = '3.4.5' as const;
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
   * Generate an SDS PDF for a completed IR35 assessment.
   * - Preconditions: assessment.status === 'completed', questionsSnapshot non-null,
   *   outcome.kind === 'IR35'.
   * - Byte stability: renderedAt = assessment.completedAt (stable across re-renders).
   * - Rollback: on row-insert failure, deletes the R2 object before rethrowing.
   */
  generateSds: tenantProcedure
    .input(generateSdsInputSchema)
    .mutation(async ({ input, ctx }) => {
      // tenant middleware asserts session+user are non-null and throws UNAUTHORIZED otherwise.
      // Re-narrowing here keeps TS happy without `!` non-null assertions.
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const userId = ctx.session.user.id;

      // 1. Load assessment with related engagement + contractor + organization.
      //    Tenant scope is injected by the Prisma client extension.
      const assessment = await ctx.db.classificationAssessment
        .findUniqueOrThrow({
          where: { id: input.classificationAssessmentId },
          include: {
            contractorAssignment: {
              include: {
                contractor: true,
                organization: true,
              },
            },
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Classification assessment not found.',
          });
        });

      // 2. Preconditions (D-04, D-06).
      if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Assessment must be completed with a captured questions snapshot before generating an SDS.',
        });
      }
      const outcome = assessment.outcome as { kind?: string } | null;
      if (!outcome || outcome.kind !== 'IR35') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'generateSds only applies to IR35 (GB) classification assessments.',
        });
      }

      // 3. Render PDF bytes. `renderedAt` is set to assessment.completedAt so
      //    repeated renders for the same assessment produce byte-identical
      //    content (apart from PDF Info timestamps, handled below).
      const renderedAt = assessment.completedAt ?? new Date(0);
      const engagement = assessment.contractorAssignment;
      const contractor = engagement.contractor;
      const organization = engagement.organization;

      const buf = await renderToBuffer(
        <IR35SDSDocument
          // Cast is required because the Prisma row's `outcome` + `answers` are
          // Json columns — the template validates their shape at runtime.
          assessment={assessment as unknown as Parameters<typeof IR35SDSDocument>[0]['assessment']}
          engagement={{
            id: engagement.id,
            displayName: contractor.displayName,
            activeFrom: engagement.activeFrom,
            activeTo: engagement.activeTo,
          }}
          contractor={{ id: contractor.id, displayName: contractor.displayName }}
          organization={{
            id: organization.id,
            name: organization.name,
            countryCode: organization.countryCode,
          }}
          renderedAt={renderedAt}
        />,
      );

      // 4. Content-addressed R2 key + rendererVersion.
      const sha256Hash = createHash('sha256').update(buf).digest('hex');
      const key = buildClassificationDocumentKey({
        organizationId: ctx.organizationId,
        classificationAssessmentId: assessment.id,
        kind: 'SDS',
        ruleSetVersion: assessment.ruleSetVersion,
        sha256: sha256Hash,
      });
      const rendererVersion = `@react-pdf/renderer@${REACT_PDF_VERSION}+${SDS_RENDERER_SLUG}@${SDS_TEMPLATE_VERSION}`;

      // 5. Upload + presign download URL.
      const downloadFilename = sanitizeFilename(`SDS-${contractor.displayName}-${engagement.id}.pdf`);
      const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
        key,
        body: buf,
        contentType: 'application/pdf',
        ttlSeconds: PDF_TTL_SECONDS,
        downloadFilename,
      });

      // 6. Insert row — rollback R2 on failure.
      try {
        const row = await ctx.db.classificationDocument.create({
          data: {
            organizationId: ctx.organizationId,
            classificationAssessmentId: assessment.id,
            kind: 'SDS',
            pdfKey: key,
            sha256Hash,
            byteSize: buf.byteLength,
            rendererVersion,
            ruleSetVersion: assessment.ruleSetVersion,
            generatedByUserId: userId,
          },
        });

        return {
          url: signedUrl,
          expiresInSeconds,
          documentId: row.id,
          byteSize: buf.byteLength,
          sha256Hash,
        };
      } catch (err) {
        // Best-effort R2 rollback so we don't leak orphan objects (T-59-10).
        await deleteObject(key).catch(() => undefined);
        throw err;
      }
    }),

  /**
   * Generate a DRV audit defense bundle PDF for a completed Schein assessment.
   * Composes 4 sections: engagement structure, independence indicators, full
   * prior-history deltas, and other-client attestation with same-tenant
   * cross-reference. Same content-addressed R2 flow as generateSds.
   */
  generateDrvDefenseBundle: tenantProcedure
    .input(generateDrvDefenseBundleInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const userId = ctx.session.user.id;

      const assessment = await ctx.db.classificationAssessment
        .findUniqueOrThrow({
          where: { id: input.classificationAssessmentId },
          include: {
            contractorAssignment: {
              include: { contractor: true, organization: true },
            },
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Classification assessment not found.',
          });
        });

      if (assessment.status !== 'completed' || assessment.questionsSnapshot === null) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Assessment must be completed with a captured questions snapshot before generating a DRV defense bundle.',
        });
      }
      const outcome = assessment.outcome as { kind?: string } | null;
      if (!outcome || outcome.kind !== 'SCHEINSELBSTANDIGKEIT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'generateDrvDefenseBundle only applies to Scheinselbständigkeit (DE) classification assessments.',
        });
      }

      // Load prior completed DE assessments for this engagement (newest first, excluding current).
      const priorAssessments = await ctx.db.classificationAssessment.findMany({
        where: {
          contractorAssignmentId: assessment.contractorAssignmentId,
          status: 'completed',
          countryCode: 'DE',
          id: { not: assessment.id },
        },
        orderBy: { completedAt: 'desc' },
      });

      // Load attestation — required for DRV bundle (T-59-17).
      const attestation = await ctx.db.ir35OtherClientAttestation.findUnique({
        where: { contractorAssignmentId: assessment.contractorAssignmentId },
      });
      if (!attestation || !attestation.signedAt) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Signed other-client attestation is required before generating a DRV defense bundle.',
        });
      }

      // Same-tenant cross-reference (T-59-12 + T-59-15).
      const crossReference = await ctx.db.contractorAssignment.findMany({
        where: {
          contractorId: assessment.contractorAssignment.contractorId,
          organizationId: ctx.organizationId,
          id: { not: assessment.contractorAssignmentId },
        },
        orderBy: { activeFrom: 'desc' },
        select: {
          id: true,
          activeFrom: true,
          activeTo: true,
          status: true,
          organization: { select: { name: true } },
          project: { select: { name: true } },
        },
      });

      const renderedAt = assessment.completedAt ?? new Date(0);
      const engagement = assessment.contractorAssignment;
      const contractor = engagement.contractor;
      const organization = engagement.organization;

      const buf = await renderToBuffer(
        <DRVDefenseBundleDocument
          assessment={assessment as unknown as Parameters<typeof DRVDefenseBundleDocument>[0]['assessment']}
          priorAssessments={priorAssessments as unknown as Parameters<typeof DRVDefenseBundleDocument>[0]['priorAssessments']}
          engagement={{
            id: engagement.id,
            displayName: contractor.displayName,
            activeFrom: engagement.activeFrom,
            activeTo: engagement.activeTo,
          }}
          contractor={{ id: contractor.id, displayName: contractor.displayName }}
          organization={{
            id: organization.id,
            name: organization.name,
            countryCode: organization.countryCode,
          }}
          attestation={{
            statementText: attestation.statementText,
            signedName: attestation.signedName,
            signedAt: attestation.signedAt,
          }}
          crossReference={crossReference.map(row => ({
            id: row.id,
            activeFrom: row.activeFrom,
            activeTo: row.activeTo,
            status: row.status,
            organization: row.organization,
            project: row.project,
          }))}
          renderedAt={renderedAt}
        />,
      );

      const sha256Hash = createHash('sha256').update(buf).digest('hex');
      const key = buildClassificationDocumentKey({
        organizationId: ctx.organizationId,
        classificationAssessmentId: assessment.id,
        kind: 'DRV_DEFENSE_BUNDLE',
        ruleSetVersion: assessment.ruleSetVersion,
        sha256: sha256Hash,
      });
      const rendererVersion = `@react-pdf/renderer@${REACT_PDF_VERSION}+${DRV_RENDERER_SLUG}@${DRV_TEMPLATE_VERSION}`;

      const downloadFilename = sanitizeFilename(
        `DRV-Defense-${contractor.displayName}-${engagement.id}.pdf`,
      );
      const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
        key,
        body: buf,
        contentType: 'application/pdf',
        ttlSeconds: PDF_TTL_SECONDS,
        downloadFilename,
      });

      try {
        const row = await ctx.db.classificationDocument.create({
          data: {
            organizationId: ctx.organizationId,
            classificationAssessmentId: assessment.id,
            kind: 'DRV_DEFENSE_BUNDLE',
            pdfKey: key,
            sha256Hash,
            byteSize: buf.byteLength,
            rendererVersion,
            ruleSetVersion: assessment.ruleSetVersion,
            generatedByUserId: userId,
          },
        });

        return {
          url: signedUrl,
          expiresInSeconds,
          documentId: row.id,
          byteSize: buf.byteLength,
          sha256Hash,
        };
      } catch (err) {
        await deleteObject(key).catch(() => undefined);
        throw err;
      }
    }),

  /**
   * Re-sign an existing ClassificationDocument for download. Does NOT
   * re-upload — bytes remain byte-exact (D-05).
   */
  getDownloadUrl: tenantProcedure
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
            message: 'Document not found.',
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
  listByEngagement: tenantProcedure
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
});
