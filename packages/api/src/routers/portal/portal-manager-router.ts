// Employee-portal MANAGER router.
//
// The security contract mirrors the employee surface but over the reporting
// line: a manager may only read and act on their DIRECT REPORTS. Reports are
// resolved server-side from `managerWorkerId = ctx.workerId` (never client
// input); every mutation first re-derives the target request's own workerId and
// asserts it is a direct report via `assertIsDirectReport` BEFORE any state
// change. Leave approval REUSES the shared `finalizeApprovedLeave` transition
// (status flip + DEDUCTION ledger + balance-cache refresh) rather than
// reimplementing approval logic, and every action writes an EMPLOYEE-actor audit
// row in the same transaction.
//
// The whole namespace is dark behind `module.employee-portal` and gated on
// `portalManagerProcedure`, which admits only a caller with at least one report.

import {
  portalManagerApproveLeaveInput,
  portalManagerNoInput,
  portalManagerRejectLeaveInput,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { portalManagerProcedure } from '../../middleware/portal-auth';
import type { TxClient } from '../../services/approval-engine';
import { writeAuditLog } from '../../services/audit-writer';
import { assertIsDirectReport, resolveDirectReports } from '../../services/portal-reports';
import {
  closeLeaveFlowAsApproved,
  closeLeaveFlowAsRejected,
  finalizeApprovedLeave,
} from '../core/approval-shared';

interface TeamReportSummary {
  workerId: string;
  displayName: string | null;
  pendingLeaveCount: number;
}

interface ReportLeaveRequestView {
  id: string;
  workerId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  requestedMinutes: number;
  status: string;
}

export const portalManagerRouter = router({
  /**
   * Team overview: the caller's direct reports with a pending-leave count each.
   * (Employee time records carry no approval status and there is no employee
   * document-expiry model in v7.0, so those counts are intentionally absent
   * rather than fabricated.)
   */
  getTeamOverview: portalManagerProcedure.input(portalManagerNoInput).query(async ({ ctx }) => {
    const reports = await resolveDirectReports(ctx.db, ctx.workerId, ctx.organizationId);

    const summaries: TeamReportSummary[] = await Promise.all(
      reports.map(async report => ({
        workerId: report.workerId,
        displayName: report.displayName,
        pendingLeaveCount: await ctx.db.leaveRequest.count({
          where: {
            organizationId: ctx.organizationId,
            workerId: report.workerId,
            status: 'PENDING',
          },
        }),
      })),
    );

    return { reports: summaries };
  }),

  /**
   * Pending leave requests across the caller's direct reports. The report ids
   * are server-derived — the read takes no report id, so a smuggled `workerId`
   * is a `.strict()` rejection.
   */
  listReportLeaveRequests: portalManagerProcedure
    .input(portalManagerNoInput)
    .query(async ({ ctx }) => {
      const reports = await resolveDirectReports(ctx.db, ctx.workerId, ctx.organizationId);
      const reportIds = reports.map(report => report.workerId);
      if (reportIds.length === 0) {
        return [] as ReportLeaveRequestView[];
      }

      const rows = await ctx.db.leaveRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          workerId: { in: reportIds },
          status: 'PENDING',
        },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          workerId: true,
          leaveTypeId: true,
          startDate: true,
          endDate: true,
          requestedMinutes: true,
          status: true,
        },
      });

      return rows.map(
        (row): ReportLeaveRequestView => ({
          id: row.id,
          workerId: row.workerId,
          leaveTypeId: row.leaveTypeId,
          startDate: row.startDate,
          endDate: row.endDate,
          requestedMinutes: row.requestedMinutes,
          status: row.status,
        }),
      );
    }),

  /**
   * Approve a direct report's pending leave request. The request's OWN workerId
   * is the authoritative subject; the client `reportWorkerId` must match it and
   * be a direct report. Execution reuses `finalizeApprovedLeave` (the shared
   * transition + DEDUCTION ledger) and writes an EMPLOYEE-actor audit row.
   */
  approveReportLeaveRequest: portalManagerProcedure
    .input(portalManagerApproveLeaveInput)
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.leaveRequest.findFirst({
        where: { id: input.requestId, organizationId: ctx.organizationId },
        select: { id: true, workerId: true, status: true, approvalFlowId: true },
      });
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_REQUEST_NOT_FOUND });
      }
      if (request.workerId !== input.reportWorkerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: E.PORTAL_NOT_A_DIRECT_REPORT });
      }
      await assertIsDirectReport(ctx.db, ctx.workerId, ctx.organizationId, request.workerId);
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_REQUEST_NOT_PENDING });
      }

      // Timeout headroom: finalizeApprovedLeave materialises one
      // EmployeeTimeRecord per leave day (a full-year PARENTAL leave is ~700
      // round-trips), which exceeds Prisma's default 5s interactive-tx timeout
      // and would otherwise abort with P2028.
      await ctx.db.$transaction(
        async tx => {
          await closeLeaveFlowAsApproved(tx as TxClient, {
            approvalFlowId: request.approvalFlowId,
            organizationId: ctx.organizationId,
          });
          await finalizeApprovedLeave(tx as TxClient, {
            resourceId: request.id,
            organizationId: ctx.organizationId,
            userId: undefined,
          });
          await writeAuditLog({
            tx,
            organizationId: ctx.organizationId,
            actorType: 'EMPLOYEE',
            actorId: ctx.workerId,
            action: 'leave.request.approved',
            resourceType: 'LEAVE_REQUEST',
            resourceId: request.id,
            newValues: { status: 'APPROVED' },
            metadata: { via: 'portal-manager', reportWorkerId: request.workerId },
          });
        },
        { timeout: 120_000, maxWait: 10_000 },
      );

      return { id: request.id, status: 'APPROVED' as const };
    }),

  /**
   * Reject a direct report's pending leave request. No ledger movement (nothing
   * is deducted for a rejected request); the request is marked REJECTED and an
   * EMPLOYEE-actor audit row records the decision + optional reason.
   */
  rejectReportLeaveRequest: portalManagerProcedure
    .input(portalManagerRejectLeaveInput)
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.leaveRequest.findFirst({
        where: { id: input.requestId, organizationId: ctx.organizationId },
        select: { id: true, workerId: true, status: true, approvalFlowId: true },
      });
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.LEAVE_REQUEST_NOT_FOUND });
      }
      if (request.workerId !== input.reportWorkerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: E.PORTAL_NOT_A_DIRECT_REPORT });
      }
      await assertIsDirectReport(ctx.db, ctx.workerId, ctx.organizationId, request.workerId);
      if (request.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_REQUEST_NOT_PENDING });
      }

      await ctx.db.$transaction(async tx => {
        await closeLeaveFlowAsRejected(tx as TxClient, {
          approvalFlowId: request.approvalFlowId,
          organizationId: ctx.organizationId,
        });
        await tx.leaveRequest.update({
          where: { id: request.id },
          data: { status: 'REJECTED' },
        });
        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'EMPLOYEE',
          actorId: ctx.workerId,
          action: 'leave.request.rejected',
          resourceType: 'LEAVE_REQUEST',
          resourceId: request.id,
          newValues: { status: 'REJECTED' },
          metadata: {
            via: 'portal-manager',
            reportWorkerId: request.workerId,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        });
      });

      return { id: request.id, status: 'REJECTED' as const };
    }),
});
