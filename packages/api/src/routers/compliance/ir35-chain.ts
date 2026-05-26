// Phase 59 · Plan 03 Task 1 — ir35Chain tRPC router (CLASS-04).
//
// Manages IR35 chain participants per engagement with two-timestamp delivery
// tracking (sdsDeliveredAt / sdsAcknowledgedAt), hybrid identity (linked
// CLIENT/WORKER, free-text AGENCY/PSC), and multi-agency ordering.
//
// Auto-seed rule: On first listByEngagement call for a GB engagement with zero
// participants, seed CLIENT + WORKER rows.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { classificationProcedure } from '../../middleware/require-classification-flag';

const chainRoleSchema = z.enum(['CLIENT', 'AGENCY', 'PSC', 'WORKER']);

const participantDtoSelect = {
  id: true,
  organizationId: true,
  contractorAssignmentId: true,
  role: true,
  orderIndex: true,
  displayName: true,
  contactEmail: true,
  linkedOrganizationId: true,
  linkedContractorId: true,
  sdsDeliveredAt: true,
  sdsDeliveredNote: true,
  sdsAcknowledgedAt: true,
  sdsAcknowledgedNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

const listByEngagementInput = z.object({
  contractorAssignmentId: z.string().min(1),
});

const upsertInput = z.object({
  id: z.string().optional(),
  contractorAssignmentId: z.string().min(1),
  role: chainRoleSchema,
  orderIndex: z.number().int().min(0),
  displayName: z.string().min(1).max(200),
  contactEmail: z.email().max(320).optional().nullable(),
  linkedContractorId: z.string().optional().nullable(),
});

const reorderInput = z.object({
  contractorAssignmentId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

const markDeliveredInput = z.object({
  id: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

const markAcknowledgedInput = z.object({
  id: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

const removeInput = z.object({
  id: z.string().min(1),
});

export const ir35ChainRouter = router({
  /**
   * List chain participants for an engagement. Auto-seeds CLIENT + WORKER
   * rows on first call for GB engagements with zero participants (D-11).
   */
  listByEngagement: classificationProcedure
    .input(listByEngagementInput)
    .query(async ({ input, ctx }) => {
      const existing = await ctx.db.ir35ChainParticipant.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: { orderIndex: 'asc' },
        select: participantDtoSelect,
      });

      if (existing.length > 0) return existing;

      // Zero rows — check engagement country for auto-seed.
      const engagement = await ctx.db.contractorAssignment
        .findUniqueOrThrow({
          where: { id: input.contractorAssignmentId },
          include: {
            contractor: { select: { id: true, displayName: true, countryCode: true } },
            organization: { select: { id: true, name: true } },
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.IR35_ENGAGEMENT_NOT_FOUND,
          });
        });

      if (engagement.contractor.countryCode !== 'GB') {
        return [];
      }

      // Auto-seed CLIENT + WORKER. createMany is a single DB roundtrip; the
      // Prisma extension enforces tenant scope on inserts. On concurrent calls,
      // the second caller re-reads via the initial findMany above (after the
      // first caller commits) and returns the seeded rows without double-seed.
      await ctx.db.ir35ChainParticipant.createMany({
        data: [
          {
            organizationId: ctx.organizationId,
            contractorAssignmentId: input.contractorAssignmentId,
            role: 'CLIENT',
            orderIndex: 0,
            displayName: engagement.organization.name,
            linkedOrganizationId: ctx.organizationId,
          },
          {
            organizationId: ctx.organizationId,
            contractorAssignmentId: input.contractorAssignmentId,
            role: 'WORKER',
            orderIndex: 1,
            displayName: engagement.contractor.displayName,
            linkedContractorId: engagement.contractor.id,
          },
        ],
      });

      return ctx.db.ir35ChainParticipant.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: { orderIndex: 'asc' },
        select: participantDtoSelect,
      });
    }),

  /**
   * Create or update a participant row. Enforces:
   * - linkedContractorId must belong to the same tenant
   * - CLIENT rows always have linkedOrganizationId = tenant + no linkedContractorId
   */
  upsertParticipant: classificationProcedure.input(upsertInput).mutation(async ({ input, ctx }) => {
    if (input.linkedContractorId) {
      await ctx.db.contractor
        .findUniqueOrThrow({ where: { id: input.linkedContractorId } })
        .catch(() => {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.IR35_LINKED_CONTRACTOR_NOT_FOUND,
          });
        });
    }

    if (input.role === 'CLIENT' && input.linkedContractorId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.IR35_CLIENT_CANNOT_HAVE_LINKED_CONTRACTOR,
      });
    }

    const baseData = {
      role: input.role,
      orderIndex: input.orderIndex,
      displayName: input.displayName,
      contactEmail: input.contactEmail ?? null,
      linkedContractorId: input.role === 'CLIENT' ? null : (input.linkedContractorId ?? null),
      linkedOrganizationId: input.role === 'CLIENT' ? ctx.organizationId : null,
    };

    if (input.id) {
      return ctx.db.ir35ChainParticipant.update({
        where: { id: input.id },
        data: baseData,
        select: participantDtoSelect,
      });
    }

    return ctx.db.ir35ChainParticipant.create({
      data: {
        organizationId: ctx.organizationId,
        contractorAssignmentId: input.contractorAssignmentId,
        ...baseData,
      },
      select: participantDtoSelect,
    });
  }),

  /**
   * Reassign orderIndex values for an engagement's chain participants.
   * The server assigns orderIndex = position in orderedIds (server-of-record
   * prevents a client race from producing duplicate indices).
   */
  reorderParticipants: classificationProcedure
    .input(reorderInput)
    .mutation(async ({ input, ctx }) => {
      const current = await ctx.db.ir35ChainParticipant.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        select: { id: true },
      });

      const currentIds = new Set(current.map(r => r.id));
      const orderedSet = new Set(input.orderedIds);

      if (orderedSet.size !== input.orderedIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.IR35_DUPLICATE_IDS,
        });
      }

      if (orderedSet.size !== currentIds.size) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.IR35_ORDERED_IDS_MUST_LIST_ALL,
        });
      }

      for (const id of input.orderedIds) {
        if (!currentIds.has(id)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Participant ${id} does not belong to engagement.`,
          });
        }
      }

      // Parallel updates — every row is scoped to the engagement via where.
      await Promise.all(
        input.orderedIds.map((id, index) =>
          ctx.db.ir35ChainParticipant.update({
            where: { id },
            data: { orderIndex: index },
          }),
        ),
      );

      return ctx.db.ir35ChainParticipant.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: { orderIndex: 'asc' },
        select: participantDtoSelect,
      });
    }),

  markDelivered: classificationProcedure
    .input(markDeliveredInput)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.ir35ChainParticipant.update({
        where: { id: input.id },
        data: {
          sdsDeliveredAt: new Date(),
          sdsDeliveredNote: input.note ?? null,
        },
        select: participantDtoSelect,
      });
    }),

  markAcknowledged: classificationProcedure
    .input(markAcknowledgedInput)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.ir35ChainParticipant.update({
        where: { id: input.id },
        data: {
          sdsAcknowledgedAt: new Date(),
          sdsAcknowledgedNote: input.note ?? null,
        },
        select: participantDtoSelect,
      });
    }),

  removeParticipant: classificationProcedure.input(removeInput).mutation(async ({ input, ctx }) => {
    const row = await ctx.db.ir35ChainParticipant
      .findUniqueOrThrow({ where: { id: input.id }, select: { role: true } })
      .catch(() => {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.IR35_PARTICIPANT_NOT_FOUND,
        });
      });

    if (row.role === 'CLIENT' || row.role === 'WORKER') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.IR35_CLIENT_WORKER_CANNOT_BE_REMOVED,
      });
    }

    await ctx.db.ir35ChainParticipant.delete({ where: { id: input.id } });
    return { deletedId: input.id };
  }),
});
