/**
 * Classification read and admin procedures.
 */

import type { EngagementContext } from '@contractor-ops/compliance-policy';
import { POLICY_RULE_SET_VERSION } from '@contractor-ops/compliance-policy';
import { TRPCError } from '@trpc/server';
import { router } from '../../init';
import type { RecreateComplianceAssessmentResultEntry } from './classification-shared';
import {
  adminProcedure,
  approveSdsInput,
  CLASSIFICATION_SDS_APPROVAL_IR35_ONLY,
  classificationProcedure,
  extractOutcomeKind,
  findOrThrow,
  getByIdInput,
  getLatestInput,
  listByContractorInput,
  logEscalationInput,
  logger,
  mapCountryCodeToJurisdiction,
  outcomeSchema,
  recreateComplianceAssessmentInput,
  releaseHeldApprovalsForContractor,
  requirePermission,
  SDS_APPROVAL_ALREADY_EXISTS,
  SDS_APPROVAL_STATEMENT_EN,
  supersedeAndMaterialise,
  writeAuditLog,
} from './classification-shared';

export const classificationReadRouter = router({
  recreateComplianceAssessment: adminProcedure
    .input(recreateComplianceAssessmentInput)
    .mutation(async ({ ctx, input }) => {
      const results: RecreateComplianceAssessmentResultEntry[] = [];

      for (const contractorId of input.contractorIds) {
        try {
          const result = await ctx.db.$transaction(async tx => {
            // 1. Load latest completed assessment with contractor + assignment context.
            const latest = await tx.classificationAssessment.findFirst({
              where: {
                contractorAssignment: {
                  contractorId,
                  organizationId: ctx.organizationId, // tenant guard
                },
                status: 'COMPLETED',
              },
              orderBy: { completedAt: 'desc' },
              include: {
                contractorAssignment: {
                  select: {
                    id: true,
                    contractorId: true,
                    contractor: { select: { countryCode: true } },
                  },
                },
              },
            });

            if (!latest) {
              return {
                contractorId,
                noop: true as const,
                reason: 'no_completed_assessment' as const,
              };
            }

            // 2. Idempotency precondition. Only applies for policy_version_bump.
            //    For classification_outcome_change and admin_correction, always recompute.
            if (
              input.reason === 'policy_version_bump' &&
              latest.policyRuleSetVersion === POLICY_RULE_SET_VERSION
            ) {
              return {
                contractorId,
                noop: true as const,
                reason: 'already_current' as const,
              };
            }

            const policyRuleSetVersionBefore = latest.policyRuleSetVersion;

            const jurisdiction = mapCountryCodeToJurisdiction(latest.countryCode);
            if (jurisdiction === null) {
              // Country outside the registry's jurisdiction set — treat as no-op
              return {
                contractorId,
                noop: true as const,
                reason: 'no_completed_assessment' as const,
              };
            }

            // 3. Build engagement context (mirrors submit's pattern).
            const engagement: EngagementContext = {
              jurisdiction,
              outcome: extractOutcomeKind(latest.outcome),
              sector: null, // sector column absent from ContractorAssignment today
              contractorNationality: latest.contractorAssignment.contractor?.countryCode ?? null,
              requiresRegulatedEquipment: false,
            };

            // 4. Map input reason → supersede reason enum.
            const supersedeReason:
              | 'CLASSIFICATION_OUTCOME_CHANGE'
              | 'SUPERSEDED_BY_POLICY_VERSION'
              | 'admin_correction' =
              input.reason === 'policy_version_bump'
                ? 'SUPERSEDED_BY_POLICY_VERSION'
                : input.reason === 'classification_outcome_change'
                  ? 'CLASSIFICATION_OUTCOME_CHANGE'
                  : 'admin_correction';

            // 5. Run the supersession.
            const supersedeResult = await supersedeAndMaterialise(tx, {
              organizationId: ctx.organizationId,
              contractorId,
              contractId: null, // not bound to a specific contract for recompute
              engagement,
              reason: supersedeReason,
            });

            // 6. Snapshot current registry version onto the latest assessment.
            await tx.classificationAssessment.update({
              where: { id: latest.id },
              data: { policyRuleSetVersion: POLICY_RULE_SET_VERSION },
            });

            // Recompute can carry items forward to SATISFIED; release any
            // approval flow held by a now-satisfied BLOCKING item.
            await releaseHeldApprovalsForContractor(tx, ctx.organizationId, contractorId);

            return {
              contractorId,
              noop: false as const,
              policyRuleSetVersionBefore,
              waivedCount: supersedeResult.waivedCount,
              insertedCount: supersedeResult.insertedCount,
              carriedForwardCount: supersedeResult.carriedForwardCount,
            };
          });
          results.push(result);
        } catch (err) {
          // Per-contractor failure does NOT abort the bulk — record + continue.
          results.push({
            contractorId,
            noop: false,
            error: err instanceof Error ? err.message : 'unknown error',
          });
        }
      }

      // 7. Single AuditLog row per invocation.
      await writeAuditLog({
        tx: ctx.db,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'compliance.recompute',
        resourceType: 'CONTRACTOR',
        resourceId: input.contractorIds.length === 1 ? (input.contractorIds[0] as string) : 'BULK',
        metadata: {
          reason: input.reason,
          contractorIds: input.contractorIds,
          policyRuleSetVersionAfter: POLICY_RULE_SET_VERSION,
          results,
        },
      });

      return { results };
    }),

  // -------------------------------------------------------------------------
  // getDraft — fetch the current draft for an engagement.
  //
  // Throws PRECONDITION_FAILED if the persisted ruleSetVersion no longer
  // matches the currently-registered profile. The UI surfaces this as
  // "start a new assessment".
  // -------------------------------------------------------------------------

  getLatest: classificationProcedure.input(getLatestInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.classificationAssessment.findFirst({
      where: {
        contractorAssignmentId: input.contractorAssignmentId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!row) return null;

    // Defence-in-depth: re-parse outcome on read so a malformed/forged JSON
    // never reaches the client.
    if (row.outcome !== null && row.outcome !== undefined) {
      outcomeSchema.parse(row.outcome);
    }
    return row;
  }),

  // -------------------------------------------------------------------------
  // getById — fetch a specific assessment by id (tenant-scoped).
  //
  // Plan 05 outcome route uses this to render the exact assessment the user
  // was redirected to after submit. Returns null (not NOT_FOUND) when the
  // assessment is not visible to the caller's org — mirrors getLatest so the
  // outcome page can surface the same "not found" UX without leaking
  // cross-tenant existence (V7).
  // -------------------------------------------------------------------------

  getById: classificationProcedure.input(getByIdInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.classificationAssessment.findFirst({
      where: { id: input.assessmentId },
    });

    if (!row) return null;

    // Defence-in-depth: re-parse outcome on read so a malformed/forged JSON
    // never reaches the client. Drafts have null outcome — skip.
    //
    // safeParse, not parse: legacy / dev-seeded rows can carry an older
    // outcome shape (pre-discriminated-union schema). Throwing 500 on a
    // read makes the entire detail page unreachable. Log + redact instead
    // so the UI still renders the metadata and the malformed outcome
    // surfaces to the user as "outcome unavailable" rather than a crash.
    if (row.outcome !== null && row.outcome !== undefined) {
      const parsed = outcomeSchema.safeParse(row.outcome);
      if (!parsed.success) {
        logger.warn(
          {
            assessmentId: input.assessmentId,
            zodIssues: parsed.error.issues,
          },
          'classification.getById: outcome failed schema validation; redacting before return',
        );
        return { ...row, outcome: null };
      }
    }
    return row;
  }),

  // -------------------------------------------------------------------------
  // listByContractor — full history across all engagements of a contractor.
  //
  // Ordered draft-first, then completedAt DESC. We order in JS because
  // Prisma's enum ordering on `status` is alphabetical (`completed` sorts
  // before `draft`), which is the opposite of what the wizard wants.
  // -------------------------------------------------------------------------

  listByContractor: classificationProcedure
    .input(listByContractorInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.classificationAssessment.findMany({
        where: {
          contractorAssignment: { contractorId: input.contractorId },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const drafts = rows.filter((r: { status: string }) => r.status === 'DRAFT');
      const completed = rows.filter((r: { status: string }) => r.status === 'COMPLETED');
      return [...drafts, ...completed];
    }),

  // ---------------------------------------------------------------------------
  // logEscalation
  // ---------------------------------------------------------------------------

  /**
   * Log a classification advisory escalation event.
   * Fired automatically on amber/indeterminate verdict render (AMBER_VERDICT_AUTO)
   * and on "Get Expert Help" CTA click (GET_EXPERT_HELP_CLICK).
   * Append-only — no update or delete.
   */
  logEscalation: classificationProcedure
    .input(logEscalationInput)
    .mutation(async ({ ctx, input }) => {
      await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId },
            select: { id: true },
          }),
        'Assessment not found',
      );

      const headers = (ctx as { req?: { headers?: { get?: (k: string) => string | null } } }).req
        ?.headers;
      const ipAddress =
        headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ??
        headers?.get?.('x-real-ip') ??
        null;
      const userAgent = headers?.get?.('user-agent') ?? null;

      const event = await ctx.db.classificationEscalationEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.user?.id ?? '',
          assessmentId: input.assessmentId,
          contractorId: input.contractorId ?? null,
          verdict: input.verdict,
          triggerKind: input.triggerKind,
          referralTarget: input.referralTarget,
          ipAddress,
          userAgent,
        },
        select: { id: true },
      });

      return { eventId: event.id };
    }),

  // ---------------------------------------------------------------------------
  // approveSds
  // ---------------------------------------------------------------------------

  /**
   * Record in-app SDS approval gate.
   * Creates an SdsApproval row — required before generateSds can proceed.
   * Snapshots SDS_APPROVAL_STATEMENT_EN at approval time.
   * Throws CONFLICT if approval already exists for this assessment.
   */
  approveSds: classificationProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(approveSdsInput)
    .mutation(async ({ ctx, input }) => {
      const assessment = await findOrThrow(
        () =>
          ctx.db.classificationAssessment.findFirst({
            where: { id: input.assessmentId, status: 'COMPLETED' },
            select: { id: true, countryCode: true },
          }),
        'Completed assessment not found',
      );
      if (assessment.countryCode !== 'GB') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: CLASSIFICATION_SDS_APPROVAL_IR35_ONLY,
        });
      }

      try {
        const approval = await ctx.db.sdsApproval.create({
          data: {
            organizationId: ctx.organizationId,
            assessmentId: input.assessmentId,
            approvedByUserId: ctx.user?.id ?? '',
            approvedAt: new Date(),
            clientName: input.clientName,
            approvalStatementSnapshot: SDS_APPROVAL_STATEMENT_EN, // snapshot at approval time
          },
          select: { id: true },
        });
        return { approvalId: approval.id };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw new TRPCError({ code: 'CONFLICT', message: SDS_APPROVAL_ALREADY_EXISTS });
        }
        throw err;
      }
    }),
});
