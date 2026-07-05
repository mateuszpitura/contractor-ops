/**
 * Classification submit procedures.
 */

import type { EngagementContext } from '@contractor-ops/compliance-policy';
import { TRPCError } from '@trpc/server';
import { CLASSIFICATION_ASSESSMENT_NOT_FOUND } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { enqueueHrisEmployeePush } from '../../services/outbox/hris-push-producer';
import type { DbClient } from '../../services/types';
import type { Outcome, Prisma } from './classification-shared';
import {
  acknowledgeDisclaimerInput,
  buildQuestionsSnapshot,
  CLASSIFICATION_ALREADY_SUBMITTED,
  CLASSIFICATION_ONLY_COMPLETED_CAN_ACKNOWLEDGE,
  contractorUpdateProcedure,
  extractOutcomeKind,
  getProfileForCountry,
  mapCountryCodeToJurisdiction,
  materialiseFromPolicy,
  outcomeSchema,
  POLICY_RULE_SET_VERSION,
  releaseHeldApprovalsForContractor,
  submitInput,
  supersedeAndMaterialise,
} from './classification-shared';

type Jurisdiction = NonNullable<ReturnType<typeof mapCountryCodeToJurisdiction>>;
type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

/**
 * Materialise (first classification) or supersede-and-re-materialise (outcome
 * kind changed) the policy-derived compliance rows for a submitted assessment.
 * Runs entirely on the passed transaction client so supersession atomicity is
 * preserved alongside the assessment update in the caller's `$transaction`.
 */
async function applyPolicyMaterialisation(
  tx: TxClient,
  args: {
    jurisdiction: Jurisdiction;
    organizationId: string;
    contractorAssignmentId: string;
    validatedOutcome: Outcome;
    prior: { outcome: unknown } | null;
  },
): Promise<void> {
  const assignment = await tx.contractorAssignment.findFirst({
    where: { id: args.contractorAssignmentId },
    select: {
      id: true,
      contractorId: true,
      contractor: { select: { countryCode: true } },
    },
  });
  if (!assignment) return;

  const engagement: EngagementContext = {
    jurisdiction: args.jurisdiction,
    outcome: extractOutcomeKind(args.validatedOutcome),
    sector: null,
    // Contractor.countryCode is the closest proxy to nationality today;
    // when contractorNationality lands on Contractor in a future phase,
    // swap this read.
    contractorNationality: assignment.contractor?.countryCode ?? null,
    requiresRegulatedEquipment: false,
  };

  if (!args.prior) {
    // First classification — materialise from policy.
    await materialiseFromPolicy(tx, {
      organizationId: args.organizationId,
      contractorId: assignment.contractorId,
      contractId: null,
      engagement,
    });
    return;
  }

  if (extractOutcomeKind(args.prior.outcome) !== extractOutcomeKind(args.validatedOutcome)) {
    // Outcome kind changed — supersede prior rows and re-materialise.
    await supersedeAndMaterialise(tx, {
      organizationId: args.organizationId,
      contractorId: assignment.contractorId,
      contractId: null,
      engagement,
      reason: 'CLASSIFICATION_OUTCOME_CHANGE',
    });
    // Supersession can carry items forward to SATISFIED. Fire the
    // recovery hook for each now-satisfied BLOCKING item so any
    // PENDING_COMPLIANCE approval flow held by it can re-assert + resume.
    await releaseHeldApprovalsForContractor(tx, args.organizationId, assignment.contractorId);
  }
  // else: same outcome kind — no row churn (atomicity preserved by skipping).
}

export const classificationSubmitRouter = router({
  submit: contractorUpdateProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
    // Entire body wrapped in $transaction. Atomicity guarantees the assessment
    // update + the row materialisation/supersession are all-or-nothing.
    // DO NOT extract any logic out of this transaction without re-evaluating
    // supersession atomicity. Helpers below take `tx` so they remain inside it.
    return ctx.db.$transaction(async tx => {
      const row = await findOrThrow(
        () =>
          tx.classificationAssessment.findFirst({
            where: { id: input.assessmentId },
          }),
        CLASSIFICATION_ASSESSMENT_NOT_FOUND,
      );
      if (row.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: CLASSIFICATION_ALREADY_SUBMITTED,
        });
      }

      const profile = getProfileForCountry(row.countryCode);

      let computed: Outcome;
      try {
        computed = profile.scoreAssessment(
          row.answers as Parameters<typeof profile.scoreAssessment>[0],
        );
      } catch (err) {
        // Engine errors (MissingAnswerError, malformed answers, etc.) surface
        // as a typed BAD_REQUEST so the wizard can highlight the offending
        // questions instead of leaking a stack trace.
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            err instanceof Error
              ? `Scoring failed: ${err.message}`
              : 'Scoring failed: unknown engine error.',
        });
      }

      // Validate the computed outcome before persistence.
      const validatedOutcome = outcomeSchema.parse(computed);

      const shell = profile.buildAssessment(row.contractorAssignmentId);
      const snapshot = buildQuestionsSnapshot(profile, {
        profileId: profile.profileId,
        ruleSetVersion: profile.ruleSetVersion,
        countryCode: profile.country,
        questions: shell.questions,
      });

      const now = new Date();

      // Find prior completed assessment for outcome-change detection.
      const prior = await tx.classificationAssessment.findFirst({
        where: {
          contractorAssignmentId: row.contractorAssignmentId,
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
      });

      const updated = await tx.classificationAssessment.update({
        where: { id: row.id },
        data: {
          status: 'COMPLETED',
          outcome: validatedOutcome,
          questionsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          completedAt: now,
          // Literal `immutableAfter: new Date` — append-only marker.
          immutableAfter: new Date(now),
          // Snapshot policy rule set version onto every completed assessment.
          policyRuleSetVersion: POLICY_RULE_SET_VERSION,
        },
      });

      // Supersession-on-outcome-change OR first-classification materialisation.
      // EngagementContext.sector is null today (ContractorAssignment has no sector column);
      // de.eight_b_estg@v1 predicate returns false for null sector → conservative.
      const jurisdiction = mapCountryCodeToJurisdiction(row.countryCode);
      if (jurisdiction !== null) {
        await applyPolicyMaterialisation(tx, {
          jurisdiction,
          organizationId: row.organizationId,
          contractorAssignmentId: row.contractorAssignmentId,
          validatedOutcome,
          prior,
        });
      }

      // Auto-resolve any OPEN/ACKNOWLEDGED reassessment triggers on this
      // engagement once a fresh GB IR35 assessment has been submitted.
      // Tenant-scoped client keeps cross-org rows untouched.
      if (row.countryCode === 'GB') {
        await tx.reassessmentTrigger.updateMany({
          where: {
            contractorAssignmentId: row.contractorAssignmentId,
            status: { in: ['OPEN', 'ACKNOWLEDGED'] },
          },
          data: { status: 'RESOLVED', resolvedAt: now },
        });
      }

      // Push the classification outcome to a connected HRIS iff the assessed
      // worker is an EMPLOYEE (contractor assessments never push). No-op for
      // contractors; only enqueues an outbox row — the adapter is never called
      // inline.
      const assignment = await tx.contractorAssignment.findUnique({
        where: { id: row.contractorAssignmentId },
        select: { contractor: { select: { workerId: true } } },
      });
      const workerId = assignment?.contractor?.workerId;
      if (workerId) {
        await enqueueHrisEmployeePush(tx, {
          organizationId: row.organizationId,
          workerId,
          eventType: 'hris.classification-outcome.push',
          payload: {
            workerId,
            classificationId: updated.id,
            outcome: String((validatedOutcome as { verdict?: unknown }).verdict ?? row.countryCode),
            decidedAt: now.toISOString(),
          },
          businessEventId: updated.id,
        });
      }

      return updated;
    });
  }),

  // -------------------------------------------------------------------------
  // acknowledgeDisclaimer — idempotent disclaimer acknowledgement.
  //
  // Only operates on completed rows; draft rows throw CONFLICT so the UI
  // cannot short-circuit the wizard.
  // -------------------------------------------------------------------------

  acknowledgeDisclaimer: contractorUpdateProcedure
    .input(acknowledgeDisclaimerInput)
    .mutation(async ({ ctx, input }) => {
      const row = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId },
          }),
        CLASSIFICATION_ASSESSMENT_NOT_FOUND,
      );
      if (row.status !== 'COMPLETED') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: CLASSIFICATION_ONLY_COMPLETED_CAN_ACKNOWLEDGE,
        });
      }

      return ctx.db.classificationAssessment.update({
        where: { id: row.id },
        data: { disclaimerAcknowledgedAt: new Date() },
      });
    }),

  // -------------------------------------------------------------------------
  // getLatest — most recent completed assessment for a given engagement.
  // -------------------------------------------------------------------------
});
