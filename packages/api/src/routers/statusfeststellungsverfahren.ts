// ---------------------------------------------------------------------------
// Phase 60 · CLASS-09 — statusfeststellungsverfahren tRPC router.
// ---------------------------------------------------------------------------
//
// CRUD surface for the DRV § 7a SGB IV Statusfeststellungsverfahren clearance
// procedure. Reads gate on contractor:read; mutations gate on
// contractor:update. Tenant extension auto-scopes all reads/writes by
// organizationId.
//
// Audit trail: every mutation writes an AuditLog row via the shared
// writeAuditLog helper (Plan 60-02) with resourceType='CONTRACTOR' and
// resourceId=contractorAssignmentId — covers T-60-14 repudiation threat.
//
// Zod refine: validFrom + validTo are required when outcome is SELBSTANDIG or
// ABHANGIG; PENDING and WITHDRAWN rows may omit them.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { classificationProcedure } from '../middleware/require-classification-flag.js';
import { writeAuditLog } from '../services/audit-writer.js';

const cuid = z.string().min(1);

const contractorReadProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['read'] }),
);
const contractorUpdateProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['update'] }),
);

const outcomeEnum = z.enum(['PENDING', 'SELBSTANDIG', 'ABHANGIG', 'WITHDRAWN']);

/**
 * Input shape for create — enforces the plan's D-10 invariant that validFrom
 * and validTo must be supplied together once an outcome other than
 * PENDING/WITHDRAWN is recorded.
 */
const createInput = z
  .object({
    contractorAssignmentId: cuid,
    filedAt: z.coerce.date(),
    drvReference: z.string().min(1).max(100),
    outcome: outcomeEnum.default('PENDING'),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    d =>
      d.outcome === 'PENDING' ||
      d.outcome === 'WITHDRAWN' ||
      (d.validFrom !== undefined && d.validTo !== undefined),
    {
      message: 'validFrom and validTo are required when outcome is SELBSTANDIG or ABHANGIG',
      path: ['validFrom'],
    },
  );

const updateInput = z.object({
  id: cuid,
  filedAt: z.coerce.date().optional(),
  drvReference: z.string().min(1).max(100).optional(),
  outcome: outcomeEnum.optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validTo: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
});

const listByEngagementInput = z.object({
  contractorAssignmentId: cuid,
});

const deleteInput = z.object({ id: cuid });

export const statusfeststellungsverfahrenRouter = router({
  list: contractorReadProcedure.input(listInput).query(async ({ ctx, input }) => {
    return ctx.db.statusfeststellungsverfahren.findMany({
      orderBy: [{ filedAt: 'desc' }, { id: 'asc' }],
      take: input.limit,
    });
  }),

  listByEngagement: contractorReadProcedure
    .input(listByEngagementInput)
    .query(async ({ ctx, input }) => {
      return ctx.db.statusfeststellungsverfahren.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: [{ filedAt: 'desc' }, { id: 'asc' }],
      });
    }),

  create: contractorUpdateProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const row = await ctx.db.statusfeststellungsverfahren.create({
      data: {
        organizationId: ctx.organizationId,
        contractorAssignmentId: input.contractorAssignmentId,
        filedAt: input.filedAt,
        drvReference: input.drvReference,
        outcome: input.outcome,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        notes: input.notes ?? null,
      },
    });

    // T-60-14 — audit every mutation; resourceType reuses CONTRACTOR per Pitfall 4.
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user.id,
      action: 'STATUSFESTSTELLUNGSVERFAHREN_CREATE',
      resourceType: 'CONTRACTOR',
      resourceId: input.contractorAssignmentId,
      newValues: {
        id: row.id,
        drvReference: '[REDACTED]', // T-60-10: never log drvReference verbatim
        outcome: row.outcome,
        filedAt: row.filedAt,
      },
    });

    return row;
  }),

  update: contractorUpdateProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.statusfeststellungsverfahren.findFirst({
      where: { id: input.id },
    });
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Statusfeststellungsverfahren record not found.',
      });
    }

    // Cross-field validation after merge — reject updates that would leave a
    // SELBSTANDIG/ABHANGIG row without validFrom/validTo.
    const nextOutcome = input.outcome ?? existing.outcome;
    const nextValidFrom = input.validFrom === undefined ? existing.validFrom : input.validFrom;
    const nextValidTo = input.validTo === undefined ? existing.validTo : input.validTo;
    if (
      (nextOutcome === 'SELBSTANDIG' || nextOutcome === 'ABHANGIG') &&
      (nextValidFrom === null || nextValidTo === null)
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'validFrom and validTo are required when outcome is SELBSTANDIG or ABHANGIG',
      });
    }

    const row = await ctx.db.statusfeststellungsverfahren.update({
      where: { id: input.id },
      data: {
        filedAt: input.filedAt ?? existing.filedAt,
        drvReference: input.drvReference ?? existing.drvReference,
        outcome: nextOutcome,
        validFrom: nextValidFrom,
        validTo: nextValidTo,
        notes: input.notes === undefined ? existing.notes : input.notes,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user.id,
      action: 'STATUSFESTSTELLUNGSVERFAHREN_UPDATE',
      resourceType: 'CONTRACTOR',
      resourceId: existing.contractorAssignmentId,
      newValues: {
        id: row.id,
        outcome: row.outcome,
      },
    });

    return row;
  }),

  delete: contractorUpdateProcedure.input(deleteInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.statusfeststellungsverfahren.findFirst({
      where: { id: input.id },
    });
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Statusfeststellungsverfahren record not found.',
      });
    }

    await ctx.db.statusfeststellungsverfahren.delete({ where: { id: input.id } });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.user.id,
      action: 'STATUSFESTSTELLUNGSVERFAHREN_DELETE',
      resourceType: 'CONTRACTOR',
      resourceId: existing.contractorAssignmentId,
      oldValues: {
        id: existing.id,
        outcome: existing.outcome,
      },
    });

    return { id: existing.id };
  }),
});
