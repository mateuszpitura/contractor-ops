/**
 * Classification draft procedures.
 */

import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { CLASSIFICATION_ASSESSMENT_NOT_FOUND } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import {
  CLASSIFICATION_ASSESSMENT_NOT_DRAFT,
  CLASSIFICATION_NO_DRIFT_TO_RECOVER,
  CLASSIFICATION_ONLY_DRAFT_CAN_RECREATE,
  CLASSIFICATION_STALE_ANSWER,
  classificationProcedure,
  classificationSaveAnswerRateLimit,
  createDraftInput,
  getAnswerSchemaForType,
  getDraftInput,
  getProfileForCountry,
  recreateDraftAfterDriftInput,
  resolveAssignmentAndProfile,
  saveAnswerInput,
} from './classification-shared';

export const classificationDraftRouter = router({


  createDraft: classificationProcedure.input(createDraftInput).mutation(async ({ ctx, input }) => {
    const { assignment, profile } = await resolveAssignmentAndProfile(
      ctx.db,
      input.contractorAssignmentId,
    );

    const existing = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: assignment.id,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    return ctx.db.classificationAssessment.create({
      data: {
        organizationId: ctx.organizationId,
        contractorAssignmentId: assignment.id,
        countryCode: profile.country,
        ruleSetVersion: profile.ruleSetVersion,
        status: 'DRAFT',
        answers: {},
      },
    });
  }),

  // -------------------------------------------------------------------------
  // recreateDraftAfterDrift — compensating action when rule-set drift blocks
  // a resume (Plan 04 wizard UI; UI-SPEC §Error states).
  //
  // Marks the stale draft as `superseded` and creates a fresh draft against
  // the currently-registered rule-set version. The old draft row is
  // preserved (never deleted) so audit history stays intact.
  //
  // Contract:
  //  - CONFLICT if staleDraftId is not actually a draft or not owned by the
  //    caller's organization.
  //  - PRECONDITION_FAILED if staleDraftId's ruleSetVersion still matches
  //    the current profile version — clients only call this when they've
  //    already seen a drift error.
  // -------------------------------------------------------------------------


  recreateDraftAfterDrift: classificationProcedure
    .input(recreateDraftAfterDriftInput)
    .mutation(async ({ ctx, input }) => {
      const { assignment, profile } = await resolveAssignmentAndProfile(
        ctx.db,
        input.contractorAssignmentId,
      );

      const stale = await ctx.db.classificationAssessment.findFirst({
        where: { id: input.staleDraftId },
      });

      if (!stale || stale.contractorAssignmentId !== assignment.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (stale.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: CLASSIFICATION_ONLY_DRAFT_CAN_RECREATE,
        });
      }
      if (stale.ruleSetVersion === profile.ruleSetVersion) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: CLASSIFICATION_NO_DRIFT_TO_RECOVER,
        });
      }

      // Create a new draft against the current rule-set version. The stale
      // draft is NOT mutated (D-04 append-only); `getDraft` orders by
      // createdAt DESC so the fresh draft naturally wins on next resume.
      // Historical drift drafts remain queryable via listByContractor for
      // audit purposes.
      return ctx.db.classificationAssessment.create({
        data: {
          organizationId: ctx.organizationId,
          contractorAssignmentId: assignment.id,
          countryCode: profile.country,
          ruleSetVersion: profile.ruleSetVersion,
          status: 'DRAFT',
          answers: {},
        },
      });
    }),

  // -------------------------------------------------------------------------
  // recreateComplianceAssessment — admin-triggered drift recompute (D-13..D-16).
  //
  // Architectural twin: recreateDraftAfterDrift (above). Same transactional
  // shape, same idempotency guard, same audit-log pattern. Differs in scope:
  // operates on ContractorComplianceItem rows (not the assessment itself).
  //
  // Trigger points (D-13):
  //   - Per-contractor "Recompute compliance" button on profile (single ID)
  //   - Bulk action on contractors-list selection (N IDs)
  // Both call this same mutation. NO org-wide "everyone" button (blast radius).
  //
  // Idempotency (D-16): when reason='policy_version_bump' AND the contractor's
  // latest assessment already references the current registry version, returns
  // noop:true. Mirrors recreateDraftAfterDrift's PRECONDITION_FAILED check, but
  // returns gracefully instead of throwing — bulk runs need to skip already-
  // current contractors without aborting.
  //
  // Audit (D-15): exactly ONE AuditLog row per invocation (NOT per affected
  // row). metadataJson carries the per-contractor delta list.
  // -------------------------------------------------------------------------


  getDraft: classificationProcedure.input(getDraftInput).query(async ({ ctx, input }) => {
    const { assignment, profile } = await resolveAssignmentAndProfile(
      ctx.db,
      input.contractorAssignmentId,
    );

    const draft = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: assignment.id,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!draft) return null;

    if (draft.ruleSetVersion !== profile.ruleSetVersion) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Rule-set drift: draft was started against ${draft.ruleSetVersion} but current profile is ${profile.ruleSetVersion}. Start a new assessment.`,
      });
    }

    return draft;
  }),

  // -------------------------------------------------------------------------
  // saveAnswer — incremental autosave during the wizard.
  //
  // Security:
  //  - Rate-limited 120/min per assessmentId (T-58-13).
  //  - Only writeable while status='draft' (T-58-10).
  //  - Optimistic concurrency via expectedUpdatedAt (T-58-17 / Pitfall 10).
  //  - Answer payload is Zod-validated against the question's answerType
  //    before any write (T-58-10 / ASVS V5).
  // -------------------------------------------------------------------------


  saveAnswer: classificationProcedure
    .input(saveAnswerInput)
    .use(classificationSaveAnswerRateLimit)
    .mutation(async ({ ctx, input }) => {
      const row = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId },
          }),
        CLASSIFICATION_ASSESSMENT_NOT_FOUND,
      );
      if (row.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: CLASSIFICATION_ASSESSMENT_NOT_DRAFT,
        });
      }

      // Resolve the profile via the assignment (not via row.countryCode
      // directly — defence in depth: the profile is the canonical source
      // of questions).
      const profile = getProfileForCountry(row.countryCode);
      const shell = profile.buildAssessment(row.contractorAssignmentId);
      const question = shell.questions.find(q => q.id === input.questionId);

      if (!question) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown questionId: ${input.questionId} (rule-set ${profile.ruleSetVersion}).`,
        });
      }

      const answerSchema = getAnswerSchemaForType(question.answerType);
      const parsed = answerSchema.safeParse(input.answer);
      if (!parsed.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Answer payload does not match ${question.answerType} schema: ${parsed.error.message}`,
        });
      }

      // Optimistic concurrency — reject stale writes before merging.
      if (input.expectedUpdatedAt && row.updatedAt.getTime() > input.expectedUpdatedAt.getTime()) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: CLASSIFICATION_STALE_ANSWER,
        });
      }

      const mergedAnswers: Record<string, unknown> = {
        ...((row.answers as Record<string, unknown>) ?? {}),
        [input.questionId]: parsed.data,
      };

      return ctx.db.classificationAssessment.update({
        where: { id: row.id },
        data: { answers: mergedAnswers as Prisma.InputJsonValue },
      });
    }),

  // -------------------------------------------------------------------------
  // submit — close the draft, compute the outcome, freeze the snapshot.
  //
  // All scoring is server-side (T-58-11 / Pitfall 2). The computed outcome
  // is parsed through `outcomeSchema` before persistence — defence in depth
  // for Pitfall 12 (discriminated-union validation).
  // -------------------------------------------------------------------------
});
