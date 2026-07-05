// Employee statutory working-time router — day-grain time records + the
// synchronous on-save working-time check.
//
// upsertRecord saves one row per (worker, day) and, in the same call, runs the
// pure per-jurisdiction WT check and returns its findings ALONGSIDE the saved
// row. A breach is a NON-BLOCKING warning payload — never a thrown error — so a
// legitimate save is never hard-blocked; the true rolling weekly average is the
// daily scan's job (wt-limit-scan). Every procedure re-asserts the workforce
// flag, is HR-RBAC gated on the `employee` resource, Zod-validated, and
// audit-logs its mutation.

import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import { upsertEmployeeTimeRecordInput } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { checkWtLimits } from '../../services/wt-limit-check';

const MS_PER_DAY = 86_400_000;

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d;
}

const workforceReadProcedure = tenantProcedure.use(requirePermission({ employee: ['read'] }));
const workforceWriteProcedure = tenantProcedure.use(requirePermission({ employee: ['update'] }));

const listRecordsInput = z
  .object({
    workerId: z.string().min(1),
    from: z.string().date(),
    to: z.string().date(),
  })
  .strict()
  .refine(v => v.from <= v.to, { message: 'from must be on or before to', path: ['to'] });

const weekSummaryInput = z
  .object({
    workerId: z.string().min(1),
    weekStart: z.string().date(),
  })
  .strict();

export const employeeTimeRouter = router({
  upsertRecord: workforceWriteProcedure
    .input(upsertEmployeeTimeRecordInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const workDate = new Date(input.workDate);

      const { record, recentWeekMinutes, countryCode } = await ctx.db.$transaction(async tx => {
        const profile = await tx.employeeProfile.findFirst({
          where: { workerId: input.workerId, organizationId: ctx.organizationId },
          select: { countryCode: true },
        });
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.EMPLOYEE_WORKER_NOT_FOUND });
        }

        const data = {
          workedMinutes: input.workedMinutes,
          nightMinutes: input.nightMinutes,
          overtimeMinutes50: input.overtimeMinutes50,
          overtimeMinutes100: input.overtimeMinutes100,
          weekendHolidayMinutes: input.weekendHolidayMinutes,
          onCallMinutes: input.onCallMinutes,
          onCallLocation: input.onCallLocation ?? null,
          absenceKind: input.absenceKind ?? null,
          wtOptOut: input.wtOptOut,
          source: input.source,
        };

        const saved = await tx.employeeTimeRecord.upsert({
          where: {
            organizationId_workerId_workDate: {
              organizationId: ctx.organizationId,
              workerId: input.workerId,
              workDate,
            },
          },
          create: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            workDate,
            ...data,
          },
          update: data,
        });

        // Current-week worked minutes (including the row just saved) for the
        // synchronous weekly heuristic.
        const weekStart = isoWeekStart(workDate);
        const weekEnd = new Date(weekStart.getTime() + 6 * MS_PER_DAY);
        const weekRows = await tx.employeeTimeRecord.findMany({
          where: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            workDate: { gte: weekStart, lte: weekEnd },
          },
          select: { workedMinutes: true },
        });
        const recentWeekMinutes = weekRows.reduce((sum, r) => sum + r.workedMinutes, 0);

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'employee_time.recorded',
          resourceType: 'EMPLOYEE_TIME_RECORD',
          resourceId: saved.id,
          metadata: { workerId: input.workerId, workDate: input.workDate },
          tx,
        });

        return { record: saved, recentWeekMinutes, countryCode: profile.countryCode };
      });

      const jurisdiction = mapCountryCodeToJurisdiction(countryCode);
      const findings = jurisdiction
        ? checkWtLimits({
            jurisdiction,
            record: {
              workedMinutes: input.workedMinutes,
              nightMinutes: input.nightMinutes,
              wtOptOut: input.wtOptOut,
            },
            recentWeekMinutes,
          })
        : [];

      // Findings are a non-blocking warning payload — the save already committed.
      return { record: plain(record), findings };
    }),

  listRecords: workforceReadProcedure.input(listRecordsInput).query(async ({ ctx, input }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);
    const rows = await ctx.db.employeeTimeRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        workDate: { gte: new Date(input.from), lte: new Date(input.to) },
      },
      orderBy: { workDate: 'asc' },
    });
    return plain(rows);
  }),

  weekSummary: workforceReadProcedure.input(weekSummaryInput).query(async ({ ctx, input }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);
    const weekStart = isoWeekStart(new Date(input.weekStart));
    const weekEnd = new Date(weekStart.getTime() + 6 * MS_PER_DAY);
    const rows = await ctx.db.employeeTimeRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        workerId: input.workerId,
        workDate: { gte: weekStart, lte: weekEnd },
      },
      select: {
        workedMinutes: true,
        nightMinutes: true,
        overtimeMinutes50: true,
        overtimeMinutes100: true,
        weekendHolidayMinutes: true,
        onCallMinutes: true,
      },
    });

    const totals = rows.reduce(
      (acc, r) => ({
        workedMinutes: acc.workedMinutes + r.workedMinutes,
        nightMinutes: acc.nightMinutes + r.nightMinutes,
        overtimeMinutes50: acc.overtimeMinutes50 + r.overtimeMinutes50,
        overtimeMinutes100: acc.overtimeMinutes100 + r.overtimeMinutes100,
        weekendHolidayMinutes: acc.weekendHolidayMinutes + r.weekendHolidayMinutes,
        onCallMinutes: acc.onCallMinutes + r.onCallMinutes,
      }),
      {
        workedMinutes: 0,
        nightMinutes: 0,
        overtimeMinutes50: 0,
        overtimeMinutes100: 0,
        weekendHolidayMinutes: 0,
        onCallMinutes: 0,
      },
    );

    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      days: rows.length,
      totals,
    };
  }),
});
