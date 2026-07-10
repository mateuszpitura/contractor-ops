// Ewidencja czasu pracy router (PL KP art. 149) — generate + read the immutable
// working-time register.
//
// generate freezes the KP §149 field set for a worker-period into a new snapshot
// via the INSERT-only builder (buildEwidencjaSnapshot + supersedeAndInsertEwidencja):
// regenerating INSERTs a superseding version (version+1 + previousSnapshotId), never
// updating a prior row — the append-only trigger forbids UPDATE. The current
// register is the highest-version row. Every procedure re-asserts the workforce
// flag, is HR-RBAC gated, Zod-validated, and audit-logs the generation.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import {
  workforceReadProcedure,
  workforceWriteProcedure,
} from '../../middleware/workforce-procedures';
import type { TxClient } from '../../services/approval-engine';
import { writeAuditLog } from '../../services/audit-writer';
import {
  assertMonthAlignedPeriod,
  buildEwidencjaSnapshot,
  supersedeAndInsertEwidencja,
} from '../../services/ewidencja-builder';

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

const generateInput = z
  .object({
    workerId: z.string().min(1),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
  })
  .strict()
  .refine(v => v.periodStart <= v.periodEnd, {
    message: 'periodStart must be on or before periodEnd',
    path: ['periodEnd'],
  });

const listInput = z
  .object({
    workerId: z.string().min(1),
    periodKey: z.string().min(1).optional(),
  })
  .strict();

const getInput = z
  .object({
    workerId: z.string().min(1),
    periodKey: z.string().min(1),
  })
  .strict();

export const ewidencjaRouter = router({
  generate: workforceWriteProcedure.input(generateInput).mutation(async ({ ctx, input }) => {
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    assertMonthAlignedPeriod(periodStart, periodEnd);

    return await ctx.db.$transaction(async tx => {
      const profile = await tx.employeeProfile.findFirst({
        where: { workerId: input.workerId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.EMPLOYEE_WORKER_NOT_FOUND });
      }

      const snapshot = await buildEwidencjaSnapshot({
        tx: tx as TxClient,
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        periodStart,
        periodEnd,
      });

      const created = await supersedeAndInsertEwidencja(tx as TxClient, {
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        periodStart,
        periodEnd,
        periodKey: snapshot.periodKey,
        snapshotJson: snapshot,
        generatedByUserId: ctx.user?.id ?? null,
      });

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'ewidencja.generated',
        resourceType: 'EWIDENCJA_SNAPSHOT',
        resourceId: created.id,
        metadata: {
          workerId: input.workerId,
          periodKey: snapshot.periodKey,
          version: created.version,
        },
        tx,
      });

      return { id: created.id, version: created.version, periodKey: snapshot.periodKey };
    });
  }),

  list: workforceReadProcedure.input(listInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db.ewidencjaSnapshot.findMany({
      where: {
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        ...(input.periodKey ? { periodKey: input.periodKey } : {}),
      },
      select: {
        id: true,
        periodKey: true,
        periodStart: true,
        periodEnd: true,
        version: true,
        status: true,
        previousSnapshotId: true,
        generatedByUserId: true,
        createdAt: true,
      },
      orderBy: [{ periodKey: 'desc' }, { version: 'desc' }],
    });
    return plain(rows);
  }),

  get: workforceReadProcedure.input(getInput).query(async ({ ctx, input }) => {
    // The current register is the highest-version row for the period.
    const row = await ctx.db.ewidencjaSnapshot.findFirst({
      where: {
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        periodKey: input.periodKey,
      },
      orderBy: { version: 'desc' },
    });
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.EMPLOYEE_WORKER_NOT_FOUND });
    }
    return plain(row);
  }),
});
