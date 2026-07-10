import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';
import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  DOCUMENT_INFECTED,
  DOCUMENT_NOT_FOUND,
  PERSONNEL_DOCUMENT_ALREADY_ATTACHED,
  PERSONNEL_DOCUMENT_NOT_PENDING_REVIEW,
  PERSONNEL_FILE_DOCUMENT_NOT_FOUND,
  PERSONNEL_FILE_NOT_FOUND,
} from '../../../errors';
import { router } from '../../../init';
import { auditedMutation, auditMutationCtx } from '../../../lib/audited-mutation';
import { requirePermission } from '../../../middleware/rbac';
import { assertWorkforceEnabled } from '../../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../../middleware/tenant';
import type {
  PersonnelClassificationResult,
  PersonnelClassifierSeams,
  PersonnelSectionCode,
} from '../../../services/personnel-classifier';
import {
  classifyPersonnelDocument,
  defaultEvaluateKillSwitch,
} from '../../../services/personnel-classifier';
import { sectionToShortCode } from './section-access';

// ---------------------------------------------------------------------------
// Document → section classification for the personnel file ("akta osobowe").
//
// attachDocument links an already-persisted, virus-scanned Document into a
// worker's personnel file and runs the hybrid classifier: a deterministic
// taxonomy hit files the document into its section immediately (Document stays
// ACTIVE); an ambiguous / low-confidence / kill-switch-off result routes the
// document to the admin classify-step (Document → PENDING_REVIEW). The upload is
// NEVER blocked — the bytes are already stored, so a classifier failure degrades
// to the admin queue rather than surfacing an error.
//
// classifyApprove / classifyReject are the admin classify-step: an HR/compliance
// admin assigns the section (approve → MANUAL + Document ACTIVE) or discards the
// link (reject → Document ARCHIVED), each with a forensic audit row written in
// the same transaction. pendingReviewQueue lists the caller-org's awaiting
// documents for that step. All three admin actions require compliance:override.
// ---------------------------------------------------------------------------

const log = createLogger({ service: 'personnel-classify-router' });

const attachInput = z
  .object({
    workerId: z.string().min(1),
    documentId: z.string().min(1),
    documentType: z.string().min(1),
    documentDate: z.coerce.date().optional(),
    // Optional compliance-expiry capture the HR-dashboard doc-expiry widget reads
    // (TZ-correct band math over expiresAt, grouped by docCategory).
    expiresAt: z.coerce.date().optional(),
    docCategory: z
      .enum(['VISA', 'WORK_PERMIT', 'CONTRACT_RENEWAL', 'MEDICAL_CERT', 'TRAINING_CERT', 'OTHER'])
      .optional(),
  })
  .strict();

const approveInput = z
  .object({
    personnelFileDocumentId: z.string().min(1),
    section: z.enum(['SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D']),
  })
  .strict();

const rejectInput = z
  .object({
    personnelFileDocumentId: z.string().min(1),
    reason: z.enum(['wrong_employee', 'not_personnel_doc', 'duplicate', 'illegible']),
    note: z.string().max(1000).optional(),
  })
  .strict();

/** Short A..D code (classifier + AI-adapter dialect) → the SECTION_A..D enum stored on the row. */
const SHORT_CODE_TO_SECTION = {
  A: 'SECTION_A',
  B: 'SECTION_B',
  C: 'SECTION_C',
  D: 'SECTION_D',
} as const satisfies Record<PersonnelSectionCode, PersonnelFileSection>;

/** The regional Unleash client only recognises EU/ME/US; anything else falls back to EU. */
function coerceRegion(region: string): 'EU' | 'ME' | 'US' {
  return region === 'ME' || region === 'US' ? region : 'EU';
}

/**
 * The AI seam for the synchronous attach path. The concrete Claude Vision section
 * adapter runs out-of-band and is not available inside this request, so a taxonomy
 * miss with the kill-switch on degrades to the admin classify-step rather than an
 * inline model call. Rejecting here signals that: the caller catches it and routes
 * the upload to PENDING_REVIEW, so the document is never blocked.
 */
const routeAiTailToAdminReview: PersonnelClassifierSeams['classifyWithClaude'] = async () => {
  throw new Error('synchronous personnel section AI adapter unavailable');
};

/** Resolve the outcome of the hybrid classifier, degrading any failure to admin review. */
async function resolveClassification(params: {
  countryCode: string;
  documentType: string;
  storageKey: string;
  organizationId: string;
  region: string;
}): Promise<PersonnelClassificationResult> {
  const jurisdiction = mapCountryCodeToJurisdiction(params.countryCode);
  // An unmapped country has no section taxonomy, so it cannot be classified
  // deterministically or by the model — it goes straight to the admin queue.
  if (!jurisdiction) {
    return { classificationMethod: 'PENDING', status: 'PENDING_REVIEW', uploadBlocked: false };
  }
  try {
    return await classifyPersonnelDocument(
      {
        jurisdiction,
        documentType: params.documentType,
        storageKey: params.storageKey,
        organizationId: params.organizationId,
        region: coerceRegion(params.region),
      },
      {
        evaluateKillSwitch: defaultEvaluateKillSwitch,
        classifyWithClaude: routeAiTailToAdminReview,
      },
    );
  } catch (err) {
    // The document is already persisted; a classifier failure must not block the
    // upload. Degrade to the admin queue so an ambiguous document is never lost.
    log.warn(
      {
        organizationId: params.organizationId,
        err: err instanceof Error ? err.message : String(err),
      },
      'personnel classifier failed — routing upload to admin review',
    );
    return { classificationMethod: 'PENDING', status: 'PENDING_REVIEW', uploadBlocked: false };
  }
}

/** Split a classification result into the row columns it persists. */
function toPersistedColumns(result: PersonnelClassificationResult): {
  section: PersonnelFileSection | null;
  aiSectionGuess: PersonnelFileSection | null;
  aiConfidence: number | null;
} {
  if (result.classificationMethod === 'DETERMINISTIC') {
    return {
      section: SHORT_CODE_TO_SECTION[result.section],
      aiSectionGuess: null,
      aiConfidence: null,
    };
  }
  if (result.classificationMethod === 'AI') {
    return {
      section: SHORT_CODE_TO_SECTION[result.section],
      aiSectionGuess: SHORT_CODE_TO_SECTION[result.aiSectionGuess],
      aiConfidence: result.aiConfidence,
    };
  }
  // PENDING — no assigned section; keep any below-threshold AI guess for the admin.
  return {
    section: null,
    aiSectionGuess: result.aiSectionGuess ? SHORT_CODE_TO_SECTION[result.aiSectionGuess] : null,
    aiConfidence: result.aiConfidence ?? null,
  };
}

export const classifyRouter = router({
  /**
   * Attach an already-uploaded Document to a worker's personnel file and classify
   * it. The Document must belong to the caller org and have cleared the virus
   * scan (an INFECTED file is refused). A deterministic taxonomy hit files the
   * document immediately (Document stays ACTIVE); the ambiguous tail routes to the
   * admin queue (Document → PENDING_REVIEW). Never blocks the upload.
   */
  attachDocument: tenantProcedure
    .use(requirePermission({ employee: ['update'] }))
    .input(attachInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const file = await ctx.db.personnelFile.findFirst({
        where: { workerId: input.workerId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, countryCode: true },
      });
      if (!file) {
        throw new TRPCError({ code: 'NOT_FOUND', message: PERSONNEL_FILE_NOT_FOUND });
      }

      const doc = await ctx.db.document.findFirst({
        where: { id: input.documentId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, storageKey: true, virusScanStatus: true },
      });
      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: DOCUMENT_NOT_FOUND });
      }
      // An infected document must never be filed or sent to the classifier's model
      // path. Pending/clean scans proceed — the upload itself is never blocked.
      if (doc.virusScanStatus === 'INFECTED') {
        throw new TRPCError({ code: 'FORBIDDEN', message: DOCUMENT_INFECTED });
      }

      // documentId is unique on the join — a second attach of the same document is
      // a caller error, not a silent duplicate.
      const existing = await ctx.db.personnelFileDocument.findFirst({
        where: { documentId: input.documentId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: PERSONNEL_DOCUMENT_ALREADY_ATTACHED,
        });
      }

      const classification = await resolveClassification({
        countryCode: file.countryCode,
        documentType: input.documentType,
        storageKey: doc.storageKey,
        organizationId: ctx.organizationId,
        region: ctx.region,
      });

      const columns = toPersistedColumns(classification);
      const routeToReview = classification.status === 'PENDING_REVIEW';
      const documentStatus = routeToReview ? 'PENDING_REVIEW' : 'ACTIVE';

      const created = await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'personnel_file.document.attached',
          resourceType: 'DOCUMENT',
          resourceId: doc.id,
          metadata: {
            workerId: input.workerId,
            personnelFileId: file.id,
            classificationMethod: classification.classificationMethod,
            section: columns.section,
            documentStatus,
          },
        },
        async tx => {
          const row = await tx.personnelFileDocument.create({
            data: {
              organizationId: ctx.organizationId,
              personnelFileId: file.id,
              documentId: input.documentId,
              section: columns.section,
              documentDate: input.documentDate ?? null,
              expiresAt: input.expiresAt ?? null,
              docCategory: input.docCategory ?? null,
              classificationMethod: classification.classificationMethod,
              aiSectionGuess: columns.aiSectionGuess,
              aiConfidence: columns.aiConfidence,
            },
            select: { id: true },
          });
          // Only the ambiguous tail flips the document into the admin queue; a
          // deterministically/AI-filed document stays ACTIVE (already visible).
          if (routeToReview) {
            await tx.document.update({ where: { id: doc.id }, data: { status: 'PENDING_REVIEW' } });
          }
          return row;
        },
      );

      return {
        personnelFileDocumentId: created.id,
        classificationMethod: classification.classificationMethod,
        section: columns.section ? sectionToShortCode[columns.section] : null,
        status: documentStatus,
      };
    }),

  /**
   * Admin classify-step — approve. Assigns the admin-chosen section (MANUAL) and
   * flips the document ACTIVE (filed). Only a PENDING_REVIEW personnel document
   * owned by the caller org is eligible; the section assignment is audited in-tx.
   */
  classifyApprove: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .input(approveInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);
      return ctx.db.$transaction(async tx => {
        const pfd = await tx.personnelFileDocument.findFirst({
          where: { id: input.personnelFileDocumentId, organizationId: ctx.organizationId },
          select: { id: true, documentId: true, document: { select: { id: true, status: true } } },
        });
        if (!pfd?.document) {
          throw new TRPCError({ code: 'NOT_FOUND', message: PERSONNEL_FILE_DOCUMENT_NOT_FOUND });
        }
        if (pfd.document.status !== 'PENDING_REVIEW') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: PERSONNEL_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }

        const updated = await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'personnel_file.document.classify_approved',
            resourceType: 'DOCUMENT',
            resourceId: pfd.documentId,
            metadata: { personnelFileDocumentId: pfd.id, section: input.section },
          },
          async innerTx => {
            const row = await innerTx.personnelFileDocument.update({
              where: { id: pfd.id },
              data: { section: input.section, classificationMethod: 'MANUAL' },
              select: { id: true, section: true },
            });
            await innerTx.document.update({
              where: { id: pfd.documentId },
              data: { status: 'ACTIVE' },
            });
            return row;
          },
          tx,
        );

        return {
          personnelFileDocumentId: updated.id,
          section: updated.section ? sectionToShortCode[updated.section] : null,
          status: 'ACTIVE' as const,
        };
      });
    }),

  /**
   * Admin classify-step — reject. Archives the document (never deletes the bytes)
   * with a closed-enum reason; the personnel-file link is retained for the audit
   * trail but no longer appears in the queue once the document leaves
   * PENDING_REVIEW. Audited in-tx.
   */
  classifyReject: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .input(rejectInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);
      return ctx.db.$transaction(async tx => {
        const pfd = await tx.personnelFileDocument.findFirst({
          where: { id: input.personnelFileDocumentId, organizationId: ctx.organizationId },
          select: { id: true, documentId: true, document: { select: { id: true, status: true } } },
        });
        if (!pfd?.document) {
          throw new TRPCError({ code: 'NOT_FOUND', message: PERSONNEL_FILE_DOCUMENT_NOT_FOUND });
        }
        if (pfd.document.status !== 'PENDING_REVIEW') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: PERSONNEL_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }

        await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'personnel_file.document.classify_rejected',
            resourceType: 'DOCUMENT',
            resourceId: pfd.documentId,
            metadata: {
              personnelFileDocumentId: pfd.id,
              reason: input.reason,
              note: input.note ?? null,
            },
          },
          async innerTx => {
            await innerTx.document.update({
              where: { id: pfd.documentId },
              data: { status: 'ARCHIVED' },
            });
            return pfd;
          },
          tx,
        );

        return {
          personnelFileDocumentId: pfd.id,
          status: 'ARCHIVED' as const,
          reason: input.reason,
        };
      });
    }),

  /**
   * The admin pending-review queue: the caller-org's personnel documents whose
   * underlying Document is PENDING_REVIEW, projected for the admin classify-step
   * UI (employee, jurisdiction, filename, upload time, and any below-threshold AI
   * section guess). Tenant-scoped — only the caller org's awaiting documents.
   */
  pendingReviewQueue: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .query(async ({ ctx }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const rows = await ctx.db.personnelFileDocument.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          document: { status: 'PENDING_REVIEW' },
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          documentId: true,
          aiSectionGuess: true,
          aiConfidence: true,
          createdAt: true,
          personnelFile: { select: { workerId: true, countryCode: true } },
          document: { select: { originalFileName: true, createdAt: true } },
        },
      });

      return rows.map(row => ({
        personnelFileDocumentId: row.id,
        documentId: row.documentId,
        workerId: row.personnelFile.workerId,
        jurisdiction: mapCountryCodeToJurisdiction(row.personnelFile.countryCode),
        fileName: row.document?.originalFileName ?? null,
        uploadedAt: row.document?.createdAt ?? row.createdAt,
        aiSectionGuess: row.aiSectionGuess ? sectionToShortCode[row.aiSectionGuess] : null,
        aiConfidence: row.aiConfidence,
      }));
    }),
});
