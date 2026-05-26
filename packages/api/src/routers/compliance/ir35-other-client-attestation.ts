// Phase 59 · Plan 03 Task 2 — ir35Attestation tRPC router (CLASS-06 support).
//
// Captures the contractor's free-text "other clients" statement + typed
// signature and provides a same-tenant cross-reference table for DRV Section 4
// (the actual DRV PDF template lands in Plan 59-04).
//
// Security: getPlatformCrossReference is strictly same-tenant — no cross-tenant
// contractor data surfaces under any circumstance. PDF footer is required to
// state the view is non-exhaustive (locked phrase DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE).

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { CONTRACTOR_NOT_FOUND } from '../../errors';

import { router } from '../../init';
import { classificationProcedure } from '../../middleware/require-classification-flag';

const attestationSelect = {
  id: true,
  organizationId: true,
  contractorAssignmentId: true,
  statementText: true,
  signedName: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getInput = z.object({
  contractorAssignmentId: z.string().min(1),
});

const upsertInput = z.object({
  contractorAssignmentId: z.string().min(1),
  statementText: z.string().min(1).max(4000),
  signedName: z.string().min(1).max(200),
});

const crossReferenceInput = z.object({
  contractorId: z.string().min(1),
  excludeAssignmentId: z.string().optional(),
});

export const ir35AttestationRouter = router({
  /** Return the attestation row for an engagement (if any). */
  getForEngagement: classificationProcedure.input(getInput).query(async ({ input, ctx }) => {
    const row = await ctx.db.ir35OtherClientAttestation.findUnique({
      where: { contractorAssignmentId: input.contractorAssignmentId },
      select: attestationSelect,
    });
    return row;
  }),

  /**
   * Upsert attestation for an engagement. `signedAt` is set server-side whenever
   * statementText or signedName changes to ensure the signature timestamp is trusted.
   */
  upsert: classificationProcedure.input(upsertInput).mutation(async ({ input, ctx }) => {
    const now = new Date();
    const existing = await ctx.db.ir35OtherClientAttestation.findUnique({
      where: { contractorAssignmentId: input.contractorAssignmentId },
      select: { id: true, statementText: true, signedName: true },
    });

    if (existing) {
      const unchanged =
        existing.statementText === input.statementText && existing.signedName === input.signedName;
      return ctx.db.ir35OtherClientAttestation.update({
        where: { id: existing.id },
        data: {
          statementText: input.statementText,
          signedName: input.signedName,
          signedAt: unchanged ? undefined : now,
        },
        select: attestationSelect,
      });
    }

    return ctx.db.ir35OtherClientAttestation.create({
      data: {
        organizationId: ctx.organizationId,
        contractorAssignmentId: input.contractorAssignmentId,
        statementText: input.statementText,
        signedName: input.signedName,
        signedAt: now,
      },
      select: attestationSelect,
    });
  }),

  /**
   * Return same-tenant ContractorAssignments for the contractor (T-59-12).
   * Used by DRV Section 4 to cross-reference other engagements on this platform.
   * Never returns cross-tenant data — tenant scope is enforced by the Prisma
   * extension, and we additionally explicit-filter on ctx.organizationId below.
   */
  getPlatformCrossReference: classificationProcedure
    .input(crossReferenceInput)
    .query(async ({ input, ctx }) => {
      // Verify the contractor exists in this tenant before returning assignments.
      await ctx.db.contractor.findUniqueOrThrow({ where: { id: input.contractorId } }).catch(() => {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: CONTRACTOR_NOT_FOUND,
        });
      });

      const assignments = await ctx.db.contractorAssignment.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId, // defence-in-depth (Prisma extension also enforces)
          id: input.excludeAssignmentId ? { not: input.excludeAssignmentId } : undefined,
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

      return assignments;
    }),
});
