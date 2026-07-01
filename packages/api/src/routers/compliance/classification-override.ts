/**
 * US worker-classification override.
 *
 * A reason-required, audit-logged override of the advisory US classification
 * outcome. The scored outcome stays server-derived (the client can never assert
 * the verdict); an override records a human decision plus its reason into the
 * append-only AuditLog, which is the ledger of overrides. The advisory outcome
 * is recomputed with the resolved AB5 work state so the audit trail captures
 * exactly what the human overrode.
 *
 * Defense-in-depth gating: `classificationProcedure` (module.classification-engine)
 * plus `assertUsExpansionEnabled` for the US surface.
 */

import type { AnswerMap } from '@contractor-ops/classification';
import { resolveUsWorkState, withUsWorkState } from '@contractor-ops/classification';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CLASSIFICATION_OVERRIDE_REASON_REQUIRED,
  CLASSIFICATION_OVERRIDE_US_ONLY,
} from '../../errors';
import { router } from '../../init';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import {
  classificationProcedure,
  cuid,
  findOrThrow,
  getProfileForCountry,
  requirePermission,
  writeAuditLog,
} from './classification-shared';

/** Read the contractor's US state from the country-specific fields JSON. */
function readUsState(countryFields: unknown): string | null {
  if (countryFields && typeof countryFields === 'object' && !Array.isArray(countryFields)) {
    const state = (countryFields as Record<string, unknown>).state;
    if (typeof state === 'string' && state.trim().length > 0) return state.trim();
  }
  return null;
}

const usClassificationOverrideProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['update'] }),
);

const overrideInput = z
  .object({
    contractorAssignmentId: cuid,
    overrideVerdict: z.enum(['employee', 'independent-contractor', 'indeterminate']),
    reason: z.string().max(1000),
  })
  .strict();

export const classificationOverrideRouter = router({
  override: usClassificationOverrideProcedure
    .input(overrideInput)
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const reason = input.reason.trim();
      if (reason.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: CLASSIFICATION_OVERRIDE_REASON_REQUIRED,
        });
      }

      const assignment = await findOrThrow(
        () =>
          ctx.db.contractorAssignment.findFirst({
            where: { id: input.contractorAssignmentId },
            select: {
              id: true,
              contractorId: true,
              workState: true,
              contractor: { select: { countryCode: true, countryFields: true } },
            },
          }),
        'errors.contractor.notFound',
      );

      if (assignment.contractor.countryCode !== 'US') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: CLASSIFICATION_OVERRIDE_US_ONLY,
        });
      }

      // Engagement work-state is the primary AB5 trigger; fall back to the
      // contractor's US state when the engagement work-state is unset.
      const workState = resolveUsWorkState({
        assignmentWorkState: assignment.workState,
        contractorUsState: readUsState(assignment.contractor.countryFields),
      });

      const profile = getProfileForCountry('US');
      const latest = await ctx.db.classificationAssessment.findFirst({
        where: { contractorAssignmentId: assignment.id },
        orderBy: { updatedAt: 'desc' },
        select: { answers: true },
      });

      const answers = withUsWorkState((latest?.answers ?? {}) as AnswerMap, workState);
      const computed = profile.scoreAssessment(answers);
      if (computed.kind !== 'US_CLASSIFICATION') {
        // Invariant: the US profile always returns a US_CLASSIFICATION outcome.
        throw new Error('US classification profile returned a non-US outcome.');
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        actorName: ctx.user?.name ?? null,
        action: 'classification.override',
        resourceType: 'CONTRACTOR',
        resourceId: assignment.contractorId,
        oldValues: { verdict: computed.verdict, ab5Flag: computed.ab5Flag },
        newValues: { verdict: input.overrideVerdict },
        metadata: {
          reason,
          workState,
          ruleSetVersion: computed.ruleSetVersion,
          section530ReliefEligible: computed.section530ReliefEligible,
          advisory: true,
        },
      });

      return {
        contractorAssignmentId: assignment.id,
        computedVerdict: computed.verdict,
        overrideVerdict: input.overrideVerdict,
        ab5Flag: computed.ab5Flag,
        workState,
      };
    }),
});
