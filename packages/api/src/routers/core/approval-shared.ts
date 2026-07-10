import type { Permission, RoleName } from '@contractor-ops/auth';
import { roles } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaClient } from '@contractor-ops/db/generated/prisma/client';
import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import type { approvalQueueSchema } from '@contractor-ops/validators';
import { approvalAuditSystemLabel } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import type { z } from 'zod';
import * as E from '../../errors';
import type { TenantScopedDb } from '../../lib/tenant-db';
import type { PermissionCheckContext } from '../../middleware/rbac';
import { hasPermission } from '../../middleware/rbac';
import type { TxClient } from '../../services/approval-engine';
import { approvalStatusToSqlConditions } from '../../services/approval-filters.js';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { syncPaymentDueDeadline } from '../../services/calendar-deadline-sync';
import { enqueuePostApprovalEinvoiceJobs } from '../../services/einvoice-submission-triggers';
import { computeLeaveBalance, recomputeBalanceCache } from '../../services/leave-balance';
import { materializeApprovedLeaveDays } from '../../services/leave-ewidencja-materialization';
import { dispatch } from '../../services/notification-service';
import type { OutboxTransactionalClient } from '../../services/outbox';
import { enqueueNotificationOutboxEvent } from '../../services/outbox';

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
export function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Validates that an approval step is PENDING and assigned to the given user.
 * Throws appropriate TRPCErrors on failure. Caller is responsible for fetching
 * the step with the desired include/select to preserve Prisma types.
 */
export function validateStepForAction(
  step: { status: string; approverUserId: string | null } | null,
  userId: string | undefined,
): asserts step is NonNullable<typeof step> {
  if (!step) {
    throw new TRPCError({ code: 'NOT_FOUND', message: E.APPROVAL_STEP_NOT_FOUND });
  }

  if (step.status !== 'PENDING') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: E.APPROVAL_STEP_NOT_PENDING });
  }

  if (step.approverUserId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: E.APPROVAL_NOT_ASSIGNED });
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

/**
 * Validates that a delegate target is an active org member with the permission
 * required to action the flow's resource type.
 */
export async function assertDelegateeEligible(
  tx: TxClient,
  organizationId: string,
  delegateToUserId: string,
  resourceType: string,
): Promise<void> {
  const member = await tx.member.findFirst({
    where: { organizationId, userId: delegateToUserId, disabledAt: null },
    select: { userId: true, role: true },
  });
  if (!member) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: E.APPROVAL_DELEGATE_NOT_MEMBER });
  }

  const required: Permission =
    resourceType === 'LEAVE_REQUEST' ? { employee: ['approve_leave'] } : { invoice: ['approve'] };
  if (!memberRoleGrantsPermission(member.role, required)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: E.APPROVAL_DELEGATE_NO_PERMISSION });
  }
}

/**
 * Enqueue an approval-request notification to a newly delegated approver.
 */
export async function enqueueDelegatedApprovalNotification(
  tx: TxClient,
  params: {
    organizationId: string;
    flowId: string;
    step: { id: string; approverUserId: string | null; slaDeadline: Date | null };
    invoice: {
      id: string;
      invoiceNumber: string | null;
      totalMinor: number;
      currency: string;
      contractorId: string | null;
    } | null;
    delegatedByName: string;
  },
): Promise<void> {
  if (!(params.step.approverUserId && params.invoice)) return;

  const contractor = params.invoice.contractorId
    ? await tx.contractor.findUnique({
        where: { id: params.invoice.contractorId },
        select: { legalName: true },
      })
    : null;

  const slaDeadline = params.step.slaDeadline
    ? new Date(params.step.slaDeadline).toISOString()
    : '';
  const amount = minorToMajor(params.invoice.totalMinor, params.invoice.currency).toFixed(
    minorUnitDigits(params.invoice.currency),
  );

  await enqueueNotificationOutboxEvent({
    tx: tx as unknown as OutboxTransactionalClient,
    event: {
      organizationId: params.organizationId,
      type: 'APPROVAL_REQUEST',
      recipientUserIds: [params.step.approverUserId],
      title: `Approval delegated to you: ${params.invoice.invoiceNumber}`,
      body: `${contractor?.legalName ?? 'Unknown'} - ${amount} ${params.invoice.currency}. Delegated by ${params.delegatedByName}.`,
      entityType: 'INVOICE',
      entityId: params.invoice.id,
      metadata: {
        invoiceNumber: params.invoice.invoiceNumber,
        contractorName: contractor?.legalName ?? 'Unknown',
        amount,
        currency: params.invoice.currency,
        slaDeadline,
        invoiceId: params.invoice.id,
        flowId: params.flowId,
      },
    },
    dedupKey: `approval-delegate:${params.step.id}:${params.step.approverUserId}`,
  });
}

/**
 * Enqueue a clarification-request notification to the flow submitter.
 */
export async function enqueueClarificationNotification(
  tx: TxClient,
  params: {
    organizationId: string;
    submitterUserId: string;
    invoice: { id: string; invoiceNumber: string | null } | null;
    approverName: string;
    comment: string;
  },
): Promise<void> {
  if (!(params.submitterUserId && params.invoice)) return;

  await enqueueNotificationOutboxEvent({
    tx: tx as unknown as OutboxTransactionalClient,
    event: {
      organizationId: params.organizationId,
      type: 'APPROVAL_DECISION',
      recipientUserIds: [params.submitterUserId],
      title: `Clarification requested: ${params.invoice.invoiceNumber}`,
      body: `${params.approverName} requested clarification: ${params.comment}`,
      entityType: 'INVOICE',
      entityId: params.invoice.id,
      metadata: {
        invoiceNumber: params.invoice.invoiceNumber,
        decision: 'clarification_requested',
        approverName: params.approverName,
        comment: params.comment,
      },
    },
    dedupKey: `approval-clarification:${params.invoice.id}:${params.submitterUserId}`,
  });
}

/**
 * Dispatches an approval decision notification to the flow submitter.
 */
export function dispatchDecisionNotification(
  organizationId: string,
  decision: 'approved' | 'rejected',
  invoice: { id: string; invoiceNumber: string | null } | null,
  submitterUserId: string | null | undefined,
  approverName: string,
  comment?: string,
) {
  if (!(submitterUserId && invoice)) return;

  const title =
    decision === 'approved'
      ? `Invoice ${invoice.invoiceNumber} approved`
      : `Invoice ${invoice.invoiceNumber} rejected`;

  const body =
    decision === 'approved'
      ? `Approved by ${approverName}`
      : `Rejected by ${approverName}: ${comment ?? ''}`;

  dispatch({
    organizationId,
    type: 'APPROVAL_DECISION',
    recipientUserIds: [submitterUserId],
    title,
    body,
    entityType: 'INVOICE',
    entityId: invoice.id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      decision,
      approverName,
      ...(comment ? { comment } : {}),
    },
  }).catch(_err => {
    /* fire-and-forget */
  });
}

/**
 * Dispatches an approval request notification to the next approver in a flow.
 */
export async function dispatchNextApproverNotification(
  db: TenantScopedDb,
  organizationId: string,
  invoice: {
    id: string;
    invoiceNumber: string | null;
    totalMinor: number;
    currency: string;
    contractorId: string | null;
  },
  flowId: string,
  nextStep: { approverUserId: string | null; slaDeadline: Date | null },
) {
  if (!nextStep.approverUserId) return;

  const contractor = invoice.contractorId
    ? await db.contractor.findUnique({
        where: { id: invoice.contractorId },
        select: { legalName: true },
      })
    : null;

  const slaDeadline = nextStep.slaDeadline ? new Date(nextStep.slaDeadline).toISOString() : '';

  dispatch({
    organizationId,
    type: 'APPROVAL_REQUEST',
    recipientUserIds: [nextStep.approverUserId],
    title: `Approval requested for ${invoice.invoiceNumber}`,
    body: `${contractor?.legalName ?? 'Unknown'} - ${minorToMajor(invoice.totalMinor, invoice.currency).toFixed(minorUnitDigits(invoice.currency))} ${invoice.currency}`,
    entityType: 'INVOICE',
    entityId: invoice.id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      contractorName: contractor?.legalName ?? 'Unknown',
      amount: minorToMajor(invoice.totalMinor, invoice.currency).toFixed(
        minorUnitDigits(invoice.currency),
      ),
      currency: invoice.currency,
      slaDeadline,
      invoiceId: invoice.id,
      flowId,
    },
  }).catch(_err => {
    /* fire-and-forget */
  });
}

/**
 * Checks whether an approval step has breached its SLA deadline.
 */
export function isSlaBreach(step: {
  slaDeadline: Date | null;
  actedAt: Date | null;
  status: string;
}): boolean {
  if (!step.slaDeadline) return false;
  const now = new Date();
  return (
    (step.actedAt != null && step.actedAt > step.slaDeadline) ||
    (step.status === 'PENDING' && now > step.slaDeadline)
  );
}

/**
 * Builds the audit trail events array from a flow with steps and decisions.
 */
export function buildAuditEvents(
  flow: {
    startedAt: Date;
    completedAt: Date | null;
    status: string;
    chainConfigId: string | null;
    steps: Array<{
      name: string | null;
      stepOrder: number;
      status: string;
      slaDeadline: Date | null;
      actedAt: Date | null;
      decisions: Array<{
        decision: string;
        comment: string | null;
        createdAt: Date;
        actor: { id: string; name: string | null; email: string; image: string | null } | null;
      }>;
    }>;
  },
  chainName: string | null,
): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];

  events.push({
    type: 'system',
    label: 'submitted',
    timestamp: flow.startedAt.toISOString(),
  });

  if (flow.chainConfigId) {
    events.push({
      type: 'system',
      label: 'routed',
      chainName: chainName ?? 'Unknown chain',
      timestamp: flow.startedAt.toISOString(),
    });
  }

  for (const step of flow.steps) {
    for (const decision of step.decisions) {
      events.push({
        type: 'decision',
        label: decision.decision.toLowerCase(),
        levelName: step.name,
        stepOrder: step.stepOrder,
        actor: decision.actor,
        comment: decision.comment,
        timestamp: decision.createdAt.toISOString(),
      });
    }

    if (isSlaBreach(step)) {
      events.push({
        type: 'system',
        label: approvalAuditSystemLabel.slaBreached,
        levelName: step.name,
        timestamp: (step.slaDeadline as Date).toISOString(),
      });
    }
  }

  if (flow.completedAt) {
    events.push({
      type: 'system',
      label: flow.status === 'APPROVED' ? 'approved' : 'rejected',
      timestamp: flow.completedAt.toISOString(),
    });
  }

  events.sort(
    (a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime(),
  );

  return events;
}

/** WHERE fragments for raw SQL — must stay aligned with Prisma `where` below. */
export function approvalQueueSqlConditions(
  organizationId: string,
  approverUserId: string | undefined,
  input: z.infer<typeof approvalQueueSchema>,
) {
  const conditions = [PrismaClient.sql`s."organizationId" = ${organizationId}`];
  if (input.tab === 'my' && approverUserId) {
    conditions.push(PrismaClient.sql`s."approverUserId" = ${approverUserId}`);
  }
  const now = new Date();
  conditions.push(...approvalStatusToSqlConditions(input.status, now));
  return conditions;
}

/**
 * After an approval flow completes, mark the invoice as approved and sync the
 * payment-due calendar deadline.
 */
export async function finalizeApprovedInvoice(
  tx: TxClient,
  opts: {
    resourceId: string;
    organizationId: string;
    db: TenantScopedDb;
    userId: string | undefined;
  },
): Promise<{ organizationId: string; invoiceId: string } | null> {
  await tx.invoice.update({
    where: { id: opts.resourceId },
    data: {
      status: 'READY_FOR_PAYMENT',
      paymentStatus: 'READY',
      readyForPaymentAt: new Date(),
    },
  });

  const invoice = await tx.invoice.findUnique({
    where: { id: opts.resourceId },
    select: { id: true, invoiceNumber: true, dueDate: true, contractorId: true },
  });
  if (!invoice) return null;

  if (invoice.dueDate) {
    const contractor = invoice.contractorId
      ? await opts.db.contractor.findUnique({
          where: { id: invoice.contractorId },
          select: { displayName: true },
        })
      : null;

    void syncPaymentDueDeadline(opts.db, {
      organizationId: opts.organizationId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id.slice(-6)}`,
      contractorName: contractor?.displayName ?? 'Unknown',
      dueDate: new Date(invoice.dueDate),
      userId: opts.userId,
    }).catch(_err => {
      /* fire-and-forget */
    });
  }

  return { organizationId: opts.organizationId, invoiceId: opts.resourceId };
}

/**
 * Close a LEAVE_REQUEST approval flow as APPROVED inside the caller's tx so a
 * portal-manager decision cannot leave a PENDING step open for staff to re-act.
 */
export async function closeLeaveFlowAsApproved(
  tx: TxClient,
  opts: { approvalFlowId: string | null | undefined; organizationId: string },
): Promise<void> {
  if (!opts.approvalFlowId) return;

  const flow = await tx.approvalFlow.findFirst({
    where: { id: opts.approvalFlowId, organizationId: opts.organizationId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!flow || flow.status !== 'PENDING') return;

  const pendingStep = flow.steps.find(step => step.status === 'PENDING');
  if (pendingStep) {
    await tx.approvalStep.update({
      where: { id: pendingStep.id },
      data: { status: 'APPROVED' },
    });
  }

  await tx.approvalFlow.update({
    where: { id: flow.id },
    data: { status: 'APPROVED', completedAt: new Date() },
  });
}

/**
 * Close a LEAVE_REQUEST approval flow as REJECTED inside the caller's tx.
 */
export async function closeLeaveFlowAsRejected(
  tx: TxClient,
  opts: { approvalFlowId: string | null | undefined; organizationId: string },
): Promise<void> {
  if (!opts.approvalFlowId) return;

  const flow = await tx.approvalFlow.findFirst({
    where: { id: opts.approvalFlowId, organizationId: opts.organizationId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!flow || flow.status !== 'PENDING') return;

  const pendingStep = flow.steps.find(step => step.status === 'PENDING');
  if (pendingStep) {
    await tx.approvalStep.update({
      where: { id: pendingStep.id },
      data: { status: 'REJECTED' },
    });
  }

  await tx.approvalFlow.update({
    where: { id: flow.id },
    data: { status: 'REJECTED', completedAt: new Date() },
  });
}

/**
 * After a LEAVE_REQUEST approval flow completes, finalize the leave: mark the
 * request APPROVED, insert the DEDUCTION ledger row, and refresh the balance
 * cache — all inside the caller's transaction so a failure rolls back together.
 * Audited via writeAuditLog(action:'leave.approved'). Sibling of
 * finalizeApprovedInvoice; the invoice path is untouched.
 *
 * Idempotent when the request is already APPROVED with a matching DEDUCTION row.
 * Rejects non-PENDING requests that were not previously finalized.
 */
export async function finalizeApprovedLeave(
  tx: TxClient,
  opts: {
    resourceId: string;
    organizationId: string;
    userId: string | undefined;
  },
) {
  const leaveRequest = await tx.leaveRequest.findFirst({
    where: { id: opts.resourceId, organizationId: opts.organizationId },
    select: {
      id: true,
      workerId: true,
      leaveTypeId: true,
      requestedMinutes: true,
      startDate: true,
      endDate: true,
      status: true,
      leaveType: { select: { kind: true } },
    },
  });
  if (!leaveRequest) {
    throw new TRPCError({ code: 'NOT_FOUND', message: E.APPROVAL_FLOW_NOT_FOUND });
  }

  const existingDeduction = await tx.leaveLedgerEntry.findFirst({
    where: {
      organizationId: opts.organizationId,
      workerId: leaveRequest.workerId,
      leaveTypeId: leaveRequest.leaveTypeId,
      entryType: 'DEDUCTION',
      sourceRef: leaveRequest.id,
    },
    select: { id: true },
  });

  if (leaveRequest.status !== 'PENDING') {
    if (leaveRequest.status === 'APPROVED' && existingDeduction) return;
    throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_REQUEST_NOT_PENDING });
  }

  if (existingDeduction) return;

  const ledgerRows = await tx.leaveLedgerEntry.findMany({
    where: {
      organizationId: opts.organizationId,
      workerId: leaveRequest.workerId,
      leaveTypeId: leaveRequest.leaveTypeId,
    },
    select: { minutes: true },
  });
  const availableMinutes = computeLeaveBalance(ledgerRows);
  if (leaveRequest.requestedMinutes > availableMinutes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: E.LEAVE_INSUFFICIENT_BALANCE });
  }

  const cas = await tx.leaveRequest.updateMany({
    where: { id: leaveRequest.id, status: 'PENDING' },
    data: { status: 'APPROVED' },
  });
  if (cas.count === 0) {
    throw new TRPCError({ code: 'CONFLICT', message: E.LEAVE_REQUEST_NOT_PENDING });
  }

  await tx.leaveLedgerEntry.create({
    data: {
      organizationId: opts.organizationId,
      workerId: leaveRequest.workerId,
      leaveTypeId: leaveRequest.leaveTypeId,
      entryType: 'DEDUCTION',
      minutes: -leaveRequest.requestedMinutes,
      effectiveDate: leaveRequest.startDate,
      sourceRef: leaveRequest.id,
      createdByUserId: opts.userId ?? null,
    },
  });

  await recomputeBalanceCache(tx, {
    organizationId: opts.organizationId,
    workerId: leaveRequest.workerId,
    leaveTypeId: leaveRequest.leaveTypeId,
    year: leaveRequest.startDate.getUTCFullYear(),
  });

  await materializeApprovedLeaveDays(tx, {
    organizationId: opts.organizationId,
    workerId: leaveRequest.workerId,
    leaveTypeKind: leaveRequest.leaveType.kind,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
  });

  await writeAuditLog({
    tx,
    organizationId: opts.organizationId,
    actorType: 'USER',
    actorId: opts.userId,
    action: 'leave.approved',
    resourceType: 'LEAVE_REQUEST',
    resourceId: leaveRequest.id,
    newValues: { status: 'APPROVED' },
    metadata: { deductedMinutes: leaveRequest.requestedMinutes },
  });
}

/**
 * Fine-grained, resource-aware permission gate for the shared approval
 * procedures. The coarse `requireAnyPermission` middleware admits any caller
 * holding invoice:approve OR employee:approve_leave; this body assertion then
 * requires the EXACT permission the fetched step's resourceType demands, so a
 * leave_approver cannot action an INVOICE and an invoice approver cannot action
 * a LEAVE_REQUEST (no over-grant either direction).
 */
export async function assertApprovalActionPermission(
  ctx: PermissionCheckContext,
  resourceType: string,
): Promise<void> {
  const required: Permission =
    resourceType === 'LEAVE_REQUEST' ? { employee: ['approve_leave'] } : { invoice: ['approve'] };
  if (!(await hasPermission(ctx, required))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: E.PERMISSION_DENIED });
  }
}

export type BulkStepRow = Prisma.ApprovalStepGetPayload<{ include: { approvalFlow: true } }>;

/**
 * Runs `perStep` for each `stepId` sequentially (one `$transaction` at a time)
 * so `advanceFlow` on the same flow is never invoked concurrently.
 */
export async function processBulkApprovalSteps(
  ctx: {
    db: TenantScopedDb;
    organizationId: string;
    user?: { id?: string | null } | null;
  },
  stepIds: string[],
  perStep: (
    tx: TxClient,
    step: BulkStepRow,
  ) => Promise<{ einvoiceEnqueue?: { organizationId: string; invoiceId: string } } | void>,
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  type PerStepResult = Awaited<ReturnType<typeof perStep>>;
  const results: PromiseSettledResult<PerStepResult>[] = [];

  for (const stepId of stepIds) {
    try {
      // Timeout headroom for `perStep`: finalizing a LEAVE_REQUEST materialises
      // one EmployeeTimeRecord per leave day (a full-year PARENTAL leave is
      // ~700 round-trips), which exceeds Prisma's default 5s interactive-tx
      // timeout and would otherwise abort with P2028.
      const value = await ctx.db.$transaction(
        async tx => {
          const step = await tx.approvalStep.findFirst({
            where: {
              id: stepId,
              organizationId: ctx.organizationId,
              status: 'PENDING',
              approverUserId: ctx.user?.id ?? undefined,
            },
            include: { approvalFlow: true },
          });
          if (!step) {
            throw new Error(`Step ${stepId} not found or not assignable`);
          }
          return perStep(tx as TxClient, step);
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
      results.push({ status: 'fulfilled', value });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const einvoiceEnqueue = result.value?.einvoiceEnqueue;
    if (einvoiceEnqueue) {
      enqueuePostApprovalEinvoiceJobs(
        ctx.db as unknown as import('@contractor-ops/db').PrismaClient,
        einvoiceEnqueue,
      );
    }
  }

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason));

  if (succeeded > 0) {
    void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
  }

  return { succeeded, failed, errors };
}
