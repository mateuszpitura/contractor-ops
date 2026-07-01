import type { PersonnelFileSection } from '@contractor-ops/compliance-policy';
import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  DOCUMENT_INFECTED,
  DOCUMENT_NOT_FOUND,
  PERSONNEL_DOCUMENT_ALREADY_ATTACHED,
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
// ---------------------------------------------------------------------------

const log = createLogger({ service: 'personnel-classify-router' });

const attachInput = z
  .object({
    workerId: z.string().min(1),
    documentId: z.string().min(1),
    documentType: z.string().min(1),
    documentDate: z.coerce.date().optional(),
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
});
