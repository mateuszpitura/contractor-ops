/**
 * Shared approve/reject finalizer for integration surfaces (Slack, Teams).
 * Mirrors approval-queue.ts: RBAC, audit, invoice state, next-approver dispatch.
 */

import type { Permission, RoleName } from '@contractor-ops/auth';
import { roles } from '@contractor-ops/auth';
import type { PrismaClient } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import type { TenantScopedDb } from '../lib/tenant-db';
import {
  dispatchDecisionNotification,
  dispatchNextApproverNotification,
  finalizeApprovedInvoice,
  finalizeApprovedLeave,
  validateStepForAction,
} from '../routers/core/approval-shared';
import type { TxClient } from './approval-engine';
import { advanceFlow } from './approval-engine';
import { writeAuditLog } from './audit-writer';
import { CacheKeys, invalidateByPrefix } from './cache';
import { syncPaymentDueDeadline } from './calendar-deadline-sync';
import { enqueuePostApprovalEinvoiceJobs } from './einvoice-submission-triggers';

type DbClient = PrismaClient;

export class IntegrationApprovalError extends Error {
  readonly code: 'NOT_ASSIGNED' | 'NOT_PENDING' | 'FORBIDDEN' | 'CONFLICT' | 'NOT_FOUND';

  constructor(
    message: string,
    code: 'NOT_ASSIGNED' | 'NOT_PENDING' | 'FORBIDDEN' | 'CONFLICT' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'IntegrationApprovalError';
    this.code = code;
  }
}

function memberRoleGrantsPermission(memberRole: string, permission: Permission): boolean {
  const roleDef = roles[memberRole as RoleName];
  if (!roleDef) return false;
  const authorize = (roleDef as { authorize?: (req: Permission) => { success: boolean } })
    .authorize;
  if (typeof authorize !== 'function') return false;
  return authorize(permission).success === true;
}

async function assertIntegrationApprovalPermission(
  db: DbClient,
  organizationId: string,
  userId: string,
  resourceType: string,
): Promise<void> {
  const member = await db.member.findFirst({
    where: { organizationId, userId, disabledAt: null },
    select: { role: true },
  });
  if (!member) {
    throw new IntegrationApprovalError(E.PERMISSION_DENIED, 'FORBIDDEN');
  }

  const required: Permission =
    resourceType === 'LEAVE_REQUEST' ? { employee: ['approve_leave'] } : { invoice: ['approve'] };

  if (!memberRoleGrantsPermission(member.role, required)) {
    throw new IntegrationApprovalError(E.PERMISSION_DENIED, 'FORBIDDEN');
  }
}

export interface IntegrationApprovalInvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  totalMinor: number;
  currency: string;
  contractorId: string | null;
  dueDate: Date | null;
}

export interface IntegrationApproveResult {
  invoice: IntegrationApprovalInvoiceSummary | null;
  advanceCompleted: boolean;
  nextStepOrder?: number;
  flowId: string;
  submitterUserId: string | null;
}

async function findPendingStepForActor(
  tx: TxClient,
  opts: { organizationId: string; flowId: string; actorUserId: string },
) {
  const step = await tx.approvalStep.findFirst({
    where: {
      approvalFlowId: opts.flowId,
      organizationId: opts.organizationId,
      approverUserId: opts.actorUserId,
      status: 'PENDING',
    },
    include: { approvalFlow: true },
  });

  if (!step) {
    const existing = await tx.approvalStep.findFirst({
      where: {
        approvalFlowId: opts.flowId,
        organizationId: opts.organizationId,
        approverUserId: opts.actorUserId,
      },
    });
    if (existing) {
      throw new IntegrationApprovalError(E.APPROVAL_STEP_NOT_PENDING, 'NOT_PENDING');
    }
    throw new IntegrationApprovalError(E.APPROVAL_NOT_ASSIGNED, 'NOT_ASSIGNED');
  }

  return step;
}

/**
 * Approve the actor's pending step on a flow (Slack / Teams parity with approval-queue).
 */
export async function executeIntegrationApprovalApprove(
  db: DbClient,
  opts: {
    organizationId: string;
    flowId: string;
    actorUserId: string;
    actorName: string;
    comment?: string;
  },
): Promise<IntegrationApproveResult> {
  const result = await db.$transaction(async tx => {
    const step = await findPendingStepForActor(tx, {
      organizationId: opts.organizationId,
      flowId: opts.flowId,
      actorUserId: opts.actorUserId,
    });

    try {
      validateStepForAction(step, opts.actorUserId);
    } catch (err) {
      if (err instanceof TRPCError) {
        if (err.code === 'FORBIDDEN') {
          throw new IntegrationApprovalError(E.APPROVAL_NOT_ASSIGNED, 'NOT_ASSIGNED');
        }
        if (err.code === 'BAD_REQUEST') {
          throw new IntegrationApprovalError(E.APPROVAL_STEP_NOT_PENDING, 'NOT_PENDING');
        }
      }
      throw err;
    }

    await assertIntegrationApprovalPermission(
      tx as unknown as DbClient,
      opts.organizationId,
      opts.actorUserId,
      step.approvalFlow.resourceType,
    );

    const cas = await tx.approvalStep.updateMany({
      where: { id: step.id, status: 'PENDING', approverUserId: opts.actorUserId },
      data: {
        status: 'APPROVED',
        actedAt: new Date(),
        decision: 'APPROVE',
        comment: opts.comment ?? null,
      },
    });
    if (cas.count === 0) {
      throw new IntegrationApprovalError(E.APPROVAL_STEP_ALREADY_DECIDED, 'CONFLICT');
    }

    await tx.approvalDecision.create({
      data: {
        organizationId: opts.organizationId,
        approvalStepId: step.id,
        actorUserId: opts.actorUserId,
        decision: 'APPROVE',
        comment: opts.comment ?? null,
      },
    });

    await writeAuditLog({
      tx,
      organizationId: opts.organizationId,
      actorType: 'USER',
      actorId: opts.actorUserId,
      actorName: opts.actorName,
      action: 'approval.approve',
      resourceType: step.approvalFlow.resourceType,
      resourceId: step.approvalFlow.resourceId,
      oldValues: { status: step.status },
      newValues: { status: 'APPROVED' },
      metadata: {
        stepId: step.id,
        approvalFlowId: step.approvalFlowId,
        channel: 'integration',
        comment: opts.comment ?? null,
      },
    });

    const advanceResult = await advanceFlow(tx as TxClient, step.approvalFlowId);

    let einvoiceEnqueue: { organizationId: string; invoiceId: string } | null = null;

    if (advanceResult.completed) {
      if (step.approvalFlow.resourceType === 'LEAVE_REQUEST') {
        await finalizeApprovedLeave(tx as TxClient, {
          resourceId: step.approvalFlow.resourceId,
          organizationId: opts.organizationId,
          userId: opts.actorUserId,
        });
      } else {
        const inv = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: { paymentStatus: true },
        });
        if (!inv || inv.paymentStatus === 'PAID' || inv.paymentStatus === 'IN_RUN') {
          throw new IntegrationApprovalError(E.INVOICE_NOT_SUBMITTABLE, 'CONFLICT');
        }
        einvoiceEnqueue = await finalizeApprovedInvoice(tx as TxClient, {
          resourceId: step.approvalFlow.resourceId,
          organizationId: opts.organizationId,
          db: db as unknown as TenantScopedDb,
          userId: opts.actorUserId,
        });
      }
    }

    const invoice =
      step.approvalFlow.resourceType === 'INVOICE'
        ? await tx.invoice.findUnique({
            where: { id: step.approvalFlow.resourceId },
            select: {
              id: true,
              invoiceNumber: true,
              totalMinor: true,
              currency: true,
              contractorId: true,
              dueDate: true,
            },
          })
        : null;

    const flow = await tx.approvalFlow.findUnique({
      where: { id: step.approvalFlowId },
      select: { id: true, createdByUserId: true, steps: { orderBy: { stepOrder: 'asc' } } },
    });

    return { advanceResult, invoice, flow, einvoiceEnqueue };
  });

  if (result.einvoiceEnqueue) {
    enqueuePostApprovalEinvoiceJobs(db, result.einvoiceEnqueue);
  }

  dispatchDecisionNotification(
    opts.organizationId,
    'approved',
    result.invoice,
    result.flow?.createdByUserId,
    opts.actorName,
  );

  if (
    !result.advanceResult.completed &&
    result.advanceResult.nextStepOrder &&
    result.flow &&
    result.invoice
  ) {
    const nextStep = result.flow.steps.find(
      s => s.stepOrder === result.advanceResult.nextStepOrder,
    );
    if (nextStep) {
      void dispatchNextApproverNotification(
        db as unknown as TenantScopedDb,
        opts.organizationId,
        result.invoice,
        result.flow.id,
        nextStep,
      );
    }
  }

  if (result.advanceResult.completed && result.invoice?.dueDate) {
    const contractor = result.invoice.contractorId
      ? await db.contractor.findUnique({
          where: { id: result.invoice.contractorId },
          select: { displayName: true },
        })
      : null;
    void syncPaymentDueDeadline(db, {
      organizationId: opts.organizationId,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber ?? `INV-${result.invoice.id.slice(-6)}`,
      contractorName: contractor?.displayName ?? 'Unknown',
      dueDate: new Date(result.invoice.dueDate),
      userId: opts.actorUserId,
    }).catch(() => {
      /* fire-and-forget */
    });
  }

  void invalidateByPrefix(CacheKeys.dashboardPrefix(opts.organizationId));

  return {
    invoice: result.invoice,
    advanceCompleted: result.advanceResult.completed,
    nextStepOrder: result.advanceResult.nextStepOrder,
    flowId: opts.flowId,
    submitterUserId: result.flow?.createdByUserId ?? null,
  };
}

/**
 * Reject the actor's pending step on a flow (Slack / Teams parity with approval-queue).
 */
export async function executeIntegrationApprovalReject(
  db: DbClient,
  opts: {
    organizationId: string;
    flowId: string;
    actorUserId: string;
    actorName: string;
    comment: string;
  },
): Promise<{ invoice: { id: string; invoiceNumber: string | null } | null }> {
  const result = await db.$transaction(async tx => {
    const step = await findPendingStepForActor(tx, {
      organizationId: opts.organizationId,
      flowId: opts.flowId,
      actorUserId: opts.actorUserId,
    });

    try {
      validateStepForAction(step, opts.actorUserId);
    } catch (err) {
      if (err instanceof TRPCError) {
        if (err.code === 'FORBIDDEN') {
          throw new IntegrationApprovalError(E.APPROVAL_NOT_ASSIGNED, 'NOT_ASSIGNED');
        }
        if (err.code === 'BAD_REQUEST') {
          throw new IntegrationApprovalError(E.APPROVAL_STEP_NOT_PENDING, 'NOT_PENDING');
        }
      }
      throw err;
    }

    await assertIntegrationApprovalPermission(
      tx as unknown as DbClient,
      opts.organizationId,
      opts.actorUserId,
      step.approvalFlow.resourceType,
    );

    const cas = await tx.approvalStep.updateMany({
      where: { id: step.id, status: 'PENDING', approverUserId: opts.actorUserId },
      data: {
        status: 'REJECTED',
        actedAt: new Date(),
        decision: 'REJECT',
        comment: opts.comment,
      },
    });
    if (cas.count === 0) {
      throw new IntegrationApprovalError(E.APPROVAL_STEP_ALREADY_DECIDED, 'CONFLICT');
    }

    await tx.approvalDecision.create({
      data: {
        organizationId: opts.organizationId,
        approvalStepId: step.id,
        actorUserId: opts.actorUserId,
        decision: 'REJECT',
        comment: opts.comment,
      },
    });

    await writeAuditLog({
      tx,
      organizationId: opts.organizationId,
      actorType: 'USER',
      actorId: opts.actorUserId,
      actorName: opts.actorName,
      action: 'approval.reject',
      resourceType: step.approvalFlow.resourceType,
      resourceId: step.approvalFlow.resourceId,
      oldValues: { status: step.status },
      newValues: { status: 'REJECTED' },
      metadata: {
        stepId: step.id,
        approvalFlowId: step.approvalFlowId,
        channel: 'integration',
        comment: opts.comment,
      },
    });

    await tx.approvalFlow.update({
      where: { id: step.approvalFlowId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
    });

    if (step.approvalFlow.resourceType === 'LEAVE_REQUEST') {
      await tx.leaveRequest.update({
        where: { id: step.approvalFlow.resourceId },
        data: { status: 'REJECTED' },
      });
    } else {
      await tx.invoice.update({
        where: { id: step.approvalFlow.resourceId },
        data: {
          status: 'REJECTED',
          paymentStatus: 'NOT_READY',
          readyForPaymentAt: null,
        },
      });
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: step.approvalFlow.resourceId },
      select: { id: true, invoiceNumber: true },
    });

    const flow = await tx.approvalFlow.findUnique({
      where: { id: step.approvalFlowId },
      select: { createdByUserId: true },
    });

    return { invoice, flow };
  });

  dispatchDecisionNotification(
    opts.organizationId,
    'rejected',
    result.invoice,
    result.flow?.createdByUserId,
    opts.actorName,
    opts.comment,
  );

  void invalidateByPrefix(CacheKeys.dashboardPrefix(opts.organizationId));

  return { invoice: result.invoice };
}
