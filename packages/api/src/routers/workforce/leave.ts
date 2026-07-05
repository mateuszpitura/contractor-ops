// Leave tRPC router — request/approval + direct sick + org-config + team calendar.
//
// Two mutation surfaces sit on the append-only leave model:
//   - submitLeaveRequest routes through the generic approval-chain (an
//     ApprovalFlow with resourceType='LEAVE_REQUEST'); approve/reject is NOT
//     re-implemented here — it is delegated to the shared, now resourceType-gated
//     approval procedures so a leave_approver can action a LEAVE_REQUEST without
//     ever gaining invoice:approve (the BFLA fence).
//   - recordSickAbsence is a DIRECT absence — a notification, never an approval
//     request (e-ZLA/eAU auto-pull is a later milestone). It writes a ledger row
//     and dispatches LEAVE_SICK_RECORDED, and creates zero ApprovalFlow rows.
//
// Every procedure re-asserts the workforce flag per request, is HR-RBAC gated on
// the `employee` resource (the HR roles — never invoice:approve), takes a Zod
// input, and audit-logs its mutations inside the caller transaction.

import {
  blackoutPeriodUpsertInput,
  leaveTypeUpsertInput,
  recordSickAbsenceInput,
  submitLeaveRequestInput,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';
import type { TxClient } from '../../services/approval-engine';
import { createApprovalFlow, routeToLeaveChain } from '../../services/approval-engine';
import { writeAuditLog } from '../../services/audit-writer';
import { computeLeaveBalance, recomputeBalanceCache } from '../../services/leave-balance';
import { dispatch } from '../../services/notification-service';

// The org member roles that hold `employee:approve_leave` (mirrors
// packages/auth/src/roles.ts). A recorded sick absence notifies these users;
// the pair is the same fence the shared approval procedures enforce.
const LEAVE_APPROVER_ROLES = ['hr_admin', 'leave_approver'] as const;

const MAX_CALENDAR_SPAN_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Strips the Prisma class prototype so inferred router output types never
 * reference the generated client module (avoids TS2742). Local sibling of the
 * approval router's `plain` — kept here so the leave router does not import the
 * invoice-centric approval-shared module for one helper.
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Deterministic, per-org-unique `code` derived from the human name (the schema
 * requires a code; the upsert input carries only a name). Upper-snake slug of
 * the name, bounded to the column budget. Two distinct names that slug to the
 * same code collide on the (organizationId, code) unique — a legitimate
 * duplicate error surfaced to the caller.
 */
function deriveLeaveTypeCode(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : 'LEAVE_TYPE';
}

const workforceReadProcedure = tenantProcedure.use(requirePermission({ employee: ['read'] }));
const workforceWriteProcedure = tenantProcedure.use(requirePermission({ employee: ['update'] }));

const getBalanceInput = z
  .object({
    workerId: z.string().min(1),
    leaveTypeId: z.string().min(1),
    year: z.number().int().min(2000).max(2100).optional(),
  })
  .strict();

const listRequestsInput = z
  .object({
    workerId: z.string().min(1).optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .strict();

const teamCalendarInput = z
  .object({
    from: z.string().date(),
    to: z.string().date(),
    teamId: z.string().min(1).optional(),
  })
  .strict()
  .refine(v => v.from <= v.to, { message: 'from must be on or before to', path: ['to'] })
  .refine(
    v =>
      (new Date(v.to).getTime() - new Date(v.from).getTime()) / MS_PER_DAY <=
      MAX_CALENDAR_SPAN_DAYS,
    { message: 'calendar span too large', path: ['to'] },
  );

const idInput = z.object({ id: z.string().min(1) }).strict();

export const leaveRouter = router({
  submitLeaveRequest: workforceWriteProcedure
    .input(submitLeaveRequestInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const result = await ctx.db.$transaction(async tx => {
        const worker = await tx.worker.findFirst({
          where: {
            id: input.workerId,
            organizationId: ctx.organizationId,
            workerType: 'EMPLOYEE',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!worker) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_WORKER_NOT_FOUND });
        }

        const leaveType = await tx.leaveType.findFirst({
          where: { id: input.leaveTypeId, organizationId: ctx.organizationId, active: true },
          select: { id: true },
        });
        if (!leaveType) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_TYPE_NOT_FOUND });
        }

        // A blackout overlaps when it starts on/before the request end AND ends
        // on/after the request start. Org-wide blackouts (teamId null) always
        // apply; team-scoped blackouts apply only to that team's request.
        const blackout = await tx.blackoutPeriod.findFirst({
          where: {
            organizationId: ctx.organizationId,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            OR: [{ teamId: null }, ...(input.teamId ? [{ teamId: input.teamId }] : [])],
          },
          select: { id: true },
        });
        if (blackout) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_BLACKOUT_OVERLAP });
        }

        const ledgerRows = await tx.leaveLedgerEntry.findMany({
          where: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            leaveTypeId: input.leaveTypeId,
          },
          select: { minutes: true },
        });
        const availableMinutes = computeLeaveBalance(ledgerRows);
        if (input.requestedMinutes > availableMinutes) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_INSUFFICIENT_BALANCE });
        }

        const chainConfig = await routeToLeaveChain(tx as TxClient, ctx.organizationId);
        if (!chainConfig) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_NO_CHAIN_CONFIGURED });
        }

        const leaveRequest = await tx.leaveRequest.create({
          data: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            leaveTypeId: input.leaveTypeId,
            startDate,
            endDate,
            requestedMinutes: input.requestedMinutes,
            teamId: input.teamId ?? null,
            status: 'PENDING',
          },
          select: { id: true, teamId: true },
        });

        const flow = await createApprovalFlow(tx as TxClient, {
          organizationId: ctx.organizationId,
          resourceType: 'LEAVE_REQUEST',
          resourceId: leaveRequest.id,
          chainConfig,
          createdByUserId: ctx.user?.id ?? '',
        });

        const updated = await tx.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: { approvalFlowId: flow.id },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'leave.request.submitted',
          resourceType: 'LEAVE_REQUEST',
          resourceId: leaveRequest.id,
          newValues: { status: 'PENDING', approvalFlowId: flow.id },
          metadata: { requestedMinutes: input.requestedMinutes, leaveTypeId: input.leaveTypeId },
          tx,
        });

        return { request: updated, flowId: flow.id };
      });

      const firstStep = await ctx.db.approvalStep.findFirst({
        where: { approvalFlowId: result.flowId, organizationId: ctx.organizationId },
        orderBy: { stepOrder: 'asc' },
        select: { approverUserId: true, slaDeadline: true },
      });
      if (firstStep?.approverUserId) {
        dispatch({
          organizationId: ctx.organizationId,
          type: 'APPROVAL_REQUEST',
          recipientUserIds: [firstStep.approverUserId],
          title: 'Leave request awaiting approval',
          body: 'A leave request has been submitted and is awaiting your approval.',
          entityType: 'LEAVE_REQUEST',
          entityId: result.request.id,
          metadata: {
            requestId: result.request.id,
            flowId: result.flowId,
            slaDeadline: firstStep.slaDeadline ? firstStep.slaDeadline.toISOString() : '',
          },
        }).catch(() => {
          /* fire-and-forget */
        });
      }

      return plain(result.request);
    }),

  recordSickAbsence: workforceWriteProcedure
    .input(recordSickAbsenceInput)
    .mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const startDate = new Date(input.startDate);

      const ledgerEntry = await ctx.db.$transaction(async tx => {
        const worker = await tx.worker.findFirst({
          where: {
            id: input.workerId,
            organizationId: ctx.organizationId,
            workerType: 'EMPLOYEE',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!worker) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_WORKER_NOT_FOUND });
        }

        const sickType = await tx.leaveType.findFirst({
          where: { organizationId: ctx.organizationId, kind: 'SICK', active: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!sickType) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.LEAVE_SICK_TYPE_NOT_CONFIGURED,
          });
        }

        // Sick is a distinct leave type with its own ledger — the negative
        // DEDUCTION tracks sick minutes used, never touching the annual balance.
        const entry = await tx.leaveLedgerEntry.create({
          data: {
            organizationId: ctx.organizationId,
            workerId: input.workerId,
            leaveTypeId: sickType.id,
            entryType: 'DEDUCTION',
            minutes: -input.minutes,
            effectiveDate: startDate,
            reason: input.note ?? null,
            createdByUserId: ctx.user?.id ?? null,
          },
          select: { id: true, leaveTypeId: true },
        });

        await recomputeBalanceCache(tx as TxClient, {
          organizationId: ctx.organizationId,
          workerId: input.workerId,
          leaveTypeId: sickType.id,
          year: startDate.getUTCFullYear(),
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'leave.sick.recorded',
          resourceType: 'LEAVE_REQUEST',
          resourceId: entry.id,
          metadata: {
            workerId: input.workerId,
            minutes: input.minutes,
            leaveTypeId: sickType.id,
          },
          tx,
        });

        return entry;
      });

      const approvers = await ctx.db.member.findMany({
        where: {
          organizationId: ctx.organizationId,
          role: { in: [...LEAVE_APPROVER_ROLES] },
          disabledAt: null,
        },
        select: { userId: true },
      });
      const recipientUserIds = [...new Set(approvers.map(m => m.userId))];
      if (recipientUserIds.length > 0) {
        dispatch({
          organizationId: ctx.organizationId,
          type: 'LEAVE_SICK_RECORDED',
          recipientUserIds,
          title: 'Sick absence recorded',
          body: 'A sick absence has been recorded for an employee.',
          entityType: 'LEAVE_REQUEST',
          entityId: ledgerEntry.id,
          metadata: { workerId: input.workerId, minutes: input.minutes },
        }).catch(() => {
          /* fire-and-forget */
        });
      }

      return plain(ledgerEntry);
    }),

  getBalance: workforceReadProcedure.input(getBalanceInput).query(async ({ ctx, input }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);

    const where: {
      organizationId: string;
      workerId: string;
      leaveTypeId: string;
      effectiveDate?: { gte: Date; lt: Date };
    } = {
      organizationId: ctx.organizationId,
      workerId: input.workerId,
      leaveTypeId: input.leaveTypeId,
    };
    if (input.year !== undefined) {
      where.effectiveDate = {
        gte: new Date(Date.UTC(input.year, 0, 1)),
        lt: new Date(Date.UTC(input.year + 1, 0, 1)),
      };
    }

    const rows = await ctx.db.leaveLedgerEntry.findMany({
      where,
      select: { minutes: true },
    });

    return { availableMinutes: computeLeaveBalance(rows), ledgerEntries: rows.length };
  }),

  listRequests: workforceReadProcedure.input(listRequestsInput).query(async ({ ctx, input }) => {
    assertWorkforceEnabled(ctx.organizationId, ctx.region);

    const where = {
      organizationId: ctx.organizationId,
      ...(input.workerId ? { workerId: input.workerId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };

    const [items, total] = await Promise.all([
      ctx.db.leaveRequest.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      ctx.db.leaveRequest.count({ where }),
    ]);

    return { items: plain(items), total, page: input.page, pageSize: input.pageSize };
  }),

  leaveType: router({
    list: workforceReadProcedure.query(async ({ ctx }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);
      const rows = await ctx.db.leaveType.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { name: 'asc' },
      });
      return plain(rows);
    }),

    upsert: workforceWriteProcedure.input(leaveTypeUpsertInput).mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const data = {
        name: input.name,
        code: deriveLeaveTypeCode(input.name),
        kind: input.leaveKind,
        paid: input.paid,
        requiresApproval: input.requiresApproval,
        active: input.active,
      };

      const saved = await ctx.db.$transaction(async tx => {
        let row: { id: string };
        if (input.id) {
          const existing = await tx.leaveType.findFirst({
            where: { id: input.id, organizationId: ctx.organizationId },
            select: { id: true },
          });
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_TYPE_NOT_FOUND });
          }
          row = await tx.leaveType.update({ where: { id: input.id }, data });
        } else {
          row = await tx.leaveType.create({
            data: { organizationId: ctx.organizationId, ...data },
          });
        }

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: input.id ? 'leave.type.updated' : 'leave.type.created',
          resourceType: 'ORGANIZATION',
          resourceId: row.id,
          metadata: { code: data.code, kind: data.kind },
          tx,
        });

        return row;
      });

      return plain(saved);
    }),

    archive: workforceWriteProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const saved = await ctx.db.$transaction(async tx => {
        const existing = await tx.leaveType.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_TYPE_NOT_FOUND });
        }
        const row = await tx.leaveType.update({
          where: { id: input.id },
          data: { active: false },
        });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'leave.type.archived',
          resourceType: 'ORGANIZATION',
          resourceId: input.id,
          tx,
        });
        return row;
      });

      return plain(saved);
    }),
  }),

  blackout: router({
    list: workforceReadProcedure.query(async ({ ctx }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);
      const rows = await ctx.db.blackoutPeriod.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { startDate: 'asc' },
      });
      return plain(rows);
    }),

    upsert: workforceWriteProcedure
      .input(blackoutPeriodUpsertInput)
      .mutation(async ({ ctx, input }) => {
        assertWorkforceEnabled(ctx.organizationId, ctx.region);

        const data = {
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          teamId: input.teamId ?? null,
          reason: input.reason ?? null,
        };

        const saved = await ctx.db.$transaction(async tx => {
          let row: { id: string };
          if (input.id) {
            const existing = await tx.blackoutPeriod.findFirst({
              where: { id: input.id, organizationId: ctx.organizationId },
              select: { id: true },
            });
            if (!existing) {
              throw new TRPCError({ code: 'NOT_FOUND', message: E.BLACKOUT_PERIOD_NOT_FOUND });
            }
            row = await tx.blackoutPeriod.update({ where: { id: input.id }, data });
          } else {
            row = await tx.blackoutPeriod.create({
              data: { organizationId: ctx.organizationId, ...data },
            });
          }

          await writeAuditLog({
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user?.id ?? null,
            action: input.id ? 'leave.blackout.updated' : 'leave.blackout.created',
            resourceType: 'ORGANIZATION',
            resourceId: row.id,
            metadata: { name: input.name },
            tx,
          });

          return row;
        });

        return plain(saved);
      }),

    delete: workforceWriteProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      await ctx.db.$transaction(async tx => {
        const existing = await tx.blackoutPeriod.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.BLACKOUT_PERIOD_NOT_FOUND });
        }
        await tx.blackoutPeriod.delete({ where: { id: input.id } });
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'leave.blackout.deleted',
          resourceType: 'ORGANIZATION',
          resourceId: input.id,
          tx,
        });
      });

      return { id: input.id, deleted: true };
    }),
  }),

  listTeamCalendar: workforceReadProcedure
    .input(teamCalendarInput)
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const from = new Date(input.from);
      const to = new Date(input.to);

      const requests = await ctx.db.leaveRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: to },
          endDate: { gte: from },
          ...(input.teamId ? { teamId: input.teamId } : {}),
        },
        select: {
          id: true,
          workerId: true,
          teamId: true,
          status: true,
          startDate: true,
          endDate: true,
          requestedMinutes: true,
        },
        orderBy: { startDate: 'asc' },
      });

      const teamIds = [
        ...new Set(requests.map(r => r.teamId).filter((t): t is string => t !== null)),
      ];
      const teams = teamIds.length
        ? await ctx.db.team.findMany({
            where: { organizationId: ctx.organizationId, id: { in: teamIds } },
            select: { id: true, name: true },
          })
        : [];
      const teamName = new Map(teams.map(t => [t.id, t.name]));

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      const holidayRows = await ctx.db.publicHoliday.findMany({
        where: {
          holidayDate: { gte: from, lte: to },
          ...(org?.countryCode ? { countryCode: org.countryCode } : {}),
        },
        select: { holidayDate: true, name: true, region: true },
        orderBy: { holidayDate: 'asc' },
      });

      // Bucket every request by its same-team key (LeaveRequest.teamId, the
      // requester's team snapshot; a null teamId falls into the shared
      // "unassigned" bucket). For each day in the window a bucket is in conflict
      // when ≥2 of its requests overlap that day.
      const UNASSIGNED = 'unassigned';
      const buckets = new Map<string, typeof requests>();
      for (const r of requests) {
        const key = r.teamId ?? UNASSIGNED;
        const list = buckets.get(key);
        if (list) {
          list.push(r);
        } else {
          buckets.set(key, [r]);
        }
      }

      const dayKeys: string[] = [];
      for (let t = from.getTime(); t <= to.getTime(); t += MS_PER_DAY) {
        dayKeys.push(new Date(t).toISOString().slice(0, 10));
      }

      const teamCalendars = [...buckets.entries()].map(([key, list]) => {
        const days = dayKeys.map(dayKey => {
          const dayTime = new Date(dayKey).getTime();
          const overlapping = list.filter(
            r => r.startDate.getTime() <= dayTime && r.endDate.getTime() >= dayTime,
          );
          return {
            date: dayKey,
            count: overlapping.length,
            conflict: overlapping.length >= 2,
            requestIds: overlapping.map(r => r.id),
          };
        });
        return {
          teamId: key === UNASSIGNED ? null : key,
          teamName: key === UNASSIGNED ? null : (teamName.get(key) ?? null),
          days,
        };
      });

      return {
        from: input.from,
        to: input.to,
        teams: teamCalendars,
        holidays: holidayRows.map(h => ({
          date: h.holidayDate.toISOString().slice(0, 10),
          name: h.name,
          region: h.region,
        })),
      };
    }),
});
