/**
 * Shared helpers, schemas, and procedures for classification sub-routers.
 */

import type { Outcome } from '@contractor-ops/classification';
import {
  buildQuestionsSnapshot,
  getAnswerSchemaForType,
  getProfileForCountry,
  outcomeSchema,
} from '@contractor-ops/classification';
import { POLICY_RULE_SET_VERSION } from '@contractor-ops/compliance-policy';

// biome-ignore lint/performance/noBarrelFile: not a barrel — shared helpers/schemas/procedures module; single re-export for sub-routers
export { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { SDS_APPROVAL_STATEMENT_EN } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CLASSIFICATION_ALREADY_SUBMITTED,
  CLASSIFICATION_ASSESSMENT_NOT_DRAFT,
  CLASSIFICATION_NO_DRIFT_TO_RECOVER,
  CLASSIFICATION_ONLY_COMPLETED_CAN_ACKNOWLEDGE,
  CLASSIFICATION_ONLY_DRAFT_CAN_RECREATE,
  CLASSIFICATION_SDS_APPROVAL_IR35_ONLY,
  CLASSIFICATION_STALE_ANSWER,
  SDS_APPROVAL_ALREADY_EXISTS,
} from '../../errors';
import { findOrThrow } from '../../lib/find-or-throw';
import { classificationSaveAnswerRateLimit } from '../../middleware/classification-rate-limit';
import { adminProcedure, requirePermission } from '../../middleware/rbac';
import { classificationProcedure } from '../../middleware/require-classification-flag';
import { writeAuditLog } from '../../services/audit-writer';
import { onComplianceItemSatisfied } from '../../services/compliance-recovery';
import {
  extractOutcomeKind,
  materialiseFromPolicy,
  supersedeAndMaterialise,
} from '../../services/compliance-supersession';

export async function releaseHeldApprovalsForContractor(
  tx: Parameters<typeof onComplianceItemSatisfied>[0],
  organizationId: string,
  contractorId: string,
): Promise<void> {
  const satisfied = (await tx.contractorComplianceItem.findMany({
    where: { contractorId, severity: 'BLOCKING', status: 'SATISFIED' },
    select: { id: true },
  })) as Array<{ id: string }>;
  for (const item of satisfied) {
    await onComplianceItemSatisfied(tx, { itemId: item.id, contractorId, organizationId });
  }
}

export const cuid = z.string().min(1);

export const createDraftInput = z.object({
  contractorAssignmentId: cuid,
});

export const recreateDraftAfterDriftInput = z.object({
  contractorAssignmentId: cuid,
  staleDraftId: cuid,
});

export const recreateComplianceAssessmentInput = z.object({
  contractorIds: z.array(cuid).min(1).max(500),
  reason: z.enum(['policy_version_bump', 'classification_outcome_change', 'admin_correction']),
});

export type RecreateComplianceAssessmentResultEntry =
  | {
      contractorId: string;
      noop: true;
      reason: 'no_completed_assessment' | 'already_current';
    }
  | {
      contractorId: string;
      noop: false;
      policyRuleSetVersionBefore: string | null;
      waivedCount: number;
      insertedCount: number;
      carriedForwardCount: number;
    }
  | {
      contractorId: string;
      noop: false;
      error: string;
    };

export const getDraftInput = z.object({
  contractorAssignmentId: cuid,
});

export const saveAnswerInput = z.object({
  assessmentId: cuid,
  questionId: z.string().min(1).max(100),
  answer: z.unknown(),
  expectedUpdatedAt: z.date().optional(),
});

export const submitInput = z.object({
  assessmentId: cuid,
});

export const acknowledgeDisclaimerInput = z.object({
  assessmentId: cuid,
});

export const getLatestInput = z.object({
  contractorAssignmentId: cuid,
});

export const getByIdInput = z.object({
  assessmentId: cuid,
});

export const listByContractorInput = z.object({
  contractorId: cuid,
});

export const logger = createLogger({ service: 'classification-router' });

export const logEscalationInput = z.object({
  assessmentId: cuid,
  triggerKind: z.enum(['AMBER_VERDICT_AUTO', 'GET_EXPERT_HELP_CLICK', 'MANUAL_FLAG']),
  referralTarget: z.string().min(1).max(500),
  verdict: z.enum([
    'IR35_OUTSIDE',
    'IR35_INSIDE',
    'IR35_INDETERMINATE',
    'SCHEIN_SELFEMPLOYED',
    'SCHEIN_EMPLOYED',
    'SCHEIN_UNCLEAR',
  ]),
  contractorId: cuid.optional(),
});

export const approveSdsInput = z.object({
  assessmentId: cuid,
  clientName: z.string().min(1).max(500),
});

export const contractorUpdateProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['update'] }),
);

export type AssignmentLookup = {
  id: string;
  contractorId: string;
  contractor: { countryCode: string };
};

export async function resolveAssignmentAndProfile(
  db: {
    contractorAssignment: {
      findFirst: (args: {
        where: { id: string };
        select: {
          id: true;
          contractorId: true;
          contractor: { select: { countryCode: true } };
        };
      }) => Promise<AssignmentLookup | null>;
    };
  },
  contractorAssignmentId: string,
) {
  const assignment = await findOrThrow(
    () =>
      db.contractorAssignment.findFirst({
        where: { id: contractorAssignmentId },
        select: { id: true, contractorId: true, contractor: { select: { countryCode: true } } },
      }),
    'errors.contractor.notFound',
  );

  try {
    const profile = getProfileForCountry(assignment.contractor.countryCode);
    return { assignment, profile };
  } catch (err) {
    throw new TRPCError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message:
        err instanceof Error
          ? err.message
          : `No classification profile for country: ${assignment.contractor.countryCode}`,
    });
  }
}

export type { Outcome, Prisma };
export {
  adminProcedure,
  buildQuestionsSnapshot,
  CLASSIFICATION_ALREADY_SUBMITTED,
  CLASSIFICATION_ASSESSMENT_NOT_DRAFT,
  CLASSIFICATION_NO_DRIFT_TO_RECOVER,
  CLASSIFICATION_ONLY_COMPLETED_CAN_ACKNOWLEDGE,
  CLASSIFICATION_ONLY_DRAFT_CAN_RECREATE,
  CLASSIFICATION_SDS_APPROVAL_IR35_ONLY,
  CLASSIFICATION_STALE_ANSWER,
  classificationProcedure,
  classificationSaveAnswerRateLimit,
  extractOutcomeKind,
  findOrThrow,
  getAnswerSchemaForType,
  getProfileForCountry,
  materialiseFromPolicy,
  outcomeSchema,
  POLICY_RULE_SET_VERSION,
  requirePermission,
  SDS_APPROVAL_ALREADY_EXISTS,
  SDS_APPROVAL_STATEMENT_EN,
  supersedeAndMaterialise,
  writeAuditLog,
};
