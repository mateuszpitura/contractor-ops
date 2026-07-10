// Employee self-service portal router.
//
// The security contract of this surface is uniform: every read and the one write
// is scoped to the SESSION worker (ctx.workerId, set by portalEmployeeProcedure)
// and the session org — no procedure accepts a workerId from the client, and the
// self-scoped reads reject any unexpected input so a smuggled workerId is a hard
// rejection rather than a silently-ignored field. The time-off write reuses the
// shared leave services (balance ledger + approval chain) exactly as staff
// `leave.submitLeaveRequest` does; it never reimplements approval routing, and it
// writes an EMPLOYEE-actor audit row inside the same transaction.
//
// The whole surface is dark behind `module.employee-portal`: it is spread into
// portalAppRouter only when the flag is registered, and portalEmployeeProcedure
// re-asserts the flag per request (FORBIDDEN when dark).

import {
  portalLeaveBalanceQueryInput,
  portalTimeOffRequestInput,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { portalEmployeeProcedure } from '../../middleware/portal-auth';
import type { TxClient } from '../../services/approval-engine';
import { createApprovalFlow, routeToLeaveChain } from '../../services/approval-engine';
import { resolveApprovalFlowCreatorUserId } from '../../services/approval-flow-creator';
import { writeAuditLog } from '../../services/audit-writer';
import { computeLeaveBalance } from '../../services/leave-balance';
import { portalEmployeeAktaProcedures } from './portal-employee-akta';

/**
 * Strips the Prisma class prototype so inferred router output types never
 * reference the generated client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// Self-scoped reads take no client-named subject. An explicit `.strict()` shape
// (rather than no input parser) makes a smuggled `workerId` a hard rejection.
const listMyLeaveRequestsInput = z
  .object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  })
  .strict()
  .optional();

const myTimeInput = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .strict()
  .optional();

const myEwidencjaInput = z
  .object({
    year: z.number().int().min(2000).max(2100).optional(),
  })
  .strict()
  .optional();

export const portalEmployeeRouter = router({
  getDashboard: portalEmployeeProcedure.query(async ({ ctx }) => {
    const [balances, pendingLeaveCount, nextLeave, recentTime] = await Promise.all([
      ctx.db.leaveBalance.findMany({
        where: { organizationId: ctx.organizationId, workerId: ctx.workerId },
        select: {
          leaveTypeId: true,
          entitledMinutes: true,
          usedMinutes: true,
          carryoverMinutes: true,
        },
      }),
      ctx.db.leaveRequest.count({
        where: { organizationId: ctx.organizationId, workerId: ctx.workerId, status: 'PENDING' },
      }),
      ctx.db.leaveRequest.findFirst({
        where: { organizationId: ctx.organizationId, workerId: ctx.workerId, status: 'PENDING' },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          leaveTypeId: true,
          startDate: true,
          endDate: true,
          requestedMinutes: true,
        },
      }),
      ctx.db.employeeTimeRecord.findMany({
        where: { organizationId: ctx.organizationId, workerId: ctx.workerId },
        orderBy: { workDate: 'desc' },
        take: 5,
        select: { id: true, workDate: true, workedMinutes: true },
      }),
    ]);

    return {
      balances: plain(balances),
      pendingLeaveCount,
      nextLeave: plain(nextLeave),
      recentTime: plain(recentTime),
    };
  }),

  getLeaveBalance: portalEmployeeProcedure
    .input(portalLeaveBalanceQueryInput)
    .query(async ({ ctx, input }) => {
      const where: {
        organizationId: string;
        workerId: string;
        leaveTypeId: string;
        effectiveDate?: { gte: Date; lt: Date };
      } = {
        organizationId: ctx.organizationId,
        workerId: ctx.workerId,
        leaveTypeId: input.leaveTypeId,
      };
      if (input.year !== undefined) {
        where.effectiveDate = {
          gte: new Date(Date.UTC(input.year, 0, 1)),
          lt: new Date(Date.UTC(input.year + 1, 0, 1)),
        };
      }

      const rows = await ctx.db.leaveLedgerEntry.findMany({ where, select: { minutes: true } });
      return { leaveTypeId: input.leaveTypeId, availableMinutes: computeLeaveBalance(rows) };
    }),

  listMyLeaveRequests: portalEmployeeProcedure
    .input(listMyLeaveRequestsInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.leaveRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          workerId: ctx.workerId,
          ...(input?.status ? { status: input.status } : {}),
        },
        orderBy: { startDate: 'desc' },
      });
      return plain(rows);
    }),

  getMyTime: portalEmployeeProcedure.input(myTimeInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db.employeeTimeRecord.findMany({
      where: {
        organizationId: ctx.organizationId,
        workerId: ctx.workerId,
        ...(input?.from || input?.to
          ? {
              workDate: {
                ...(input.from ? { gte: new Date(input.from) } : {}),
                ...(input.to ? { lte: new Date(input.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { workDate: 'desc' },
    });
    return plain(rows);
  }),

  getMyEwidencja: portalEmployeeProcedure.input(myEwidencjaInput).query(async ({ ctx }) => {
    const rows = await ctx.db.ewidencjaSnapshot.findMany({
      where: { organizationId: ctx.organizationId, workerId: ctx.workerId },
      orderBy: { createdAt: 'desc' },
    });
    return plain(rows);
  }),

  submitTimeOffRequest: portalEmployeeProcedure
    .input(portalTimeOffRequestInput)
    .mutation(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const result = await ctx.db.$transaction(async tx => {
        // The subject is the session worker — an EMPLOYEE, not deleted.
        const worker = await tx.worker.findFirst({
          where: {
            id: ctx.workerId,
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

        // Org-wide blackouts always apply to an employee's own request; a
        // blackout overlaps when it starts on/before the request end AND ends
        // on/after the request start.
        const blackout = await tx.blackoutPeriod.findFirst({
          where: {
            organizationId: ctx.organizationId,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
            teamId: null,
          },
          select: { id: true },
        });
        if (blackout) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_BLACKOUT_OVERLAP });
        }

        const ledgerRows = await tx.leaveLedgerEntry.findMany({
          where: {
            organizationId: ctx.organizationId,
            workerId: ctx.workerId,
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
            workerId: ctx.workerId,
            leaveTypeId: input.leaveTypeId,
            startDate,
            endDate,
            requestedMinutes: input.requestedMinutes,
            status: 'PENDING',
          },
          select: { id: true },
        });

        // A portal-submitted request has no staff creator; the approval chain
        // still routes to the org's leave approvers by role.
        const createdByUserId = await resolveApprovalFlowCreatorUserId(
          tx as TxClient,
          ctx.organizationId,
          null,
        );

        const flow = await createApprovalFlow(tx as TxClient, {
          organizationId: ctx.organizationId,
          resourceType: 'LEAVE_REQUEST',
          resourceId: leaveRequest.id,
          chainConfig,
          createdByUserId,
        });

        const updated = await tx.leaveRequest.update({
          where: { id: leaveRequest.id },
          data: { approvalFlowId: flow.id },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'EMPLOYEE',
          actorId: ctx.workerId,
          action: 'leave.request.submitted',
          resourceType: 'LEAVE_REQUEST',
          resourceId: leaveRequest.id,
          newValues: { status: 'PENDING', approvalFlowId: flow.id },
          metadata: { requestedMinutes: input.requestedMinutes, leaveTypeId: input.leaveTypeId },
          tx,
        });

        return updated;
      });

      return plain(result);
    }),

  ...portalEmployeeAktaProcedures,
});
