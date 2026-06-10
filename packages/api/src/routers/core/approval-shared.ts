import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaClient } from '@contractor-ops/db/generated/prisma/client';
import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import type { approvalQueueSchema } from '@contractor-ops/validators';
import { approvalAuditSystemLabel } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import type { z } from 'zod';
import * as E from '../../errors';
import type { TenantScopedDb } from '../../lib/tenant-db';
import type { TxClient } from '../../services/approval-engine';
import { approvalStatusToSqlConditions } from '../../services/approval-filters.js';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { syncPaymentDueDeadline } from '../../services/calendar-deadline-sync';
import { dispatch } from '../../services/notification-service';

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
 * payment-due calendar deadline (D-07).
 */
export async function finalizeApprovedInvoice(
  tx: TxClient,
  opts: {
    resourceId: string;
    organizationId: string;
    db: TenantScopedDb;
    userId: string | undefined;
  },
) {
  await tx.invoice.update({
    where: { id: opts.resourceId },
    data: {
      status: 'APPROVED',
      paymentStatus: 'READY',
      readyForPaymentAt: new Date(),
    },
  });

  const invoice = await tx.invoice.findUnique({
    where: { id: opts.resourceId },
    select: { id: true, invoiceNumber: true, dueDate: true, contractorId: true },
  });
  if (!invoice?.dueDate) return;

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

export type BulkStepRow = Prisma.ApprovalStepGetPayload<{ include: { approvalFlow: true } }>;

/**
 * Runs `perStep` for each `stepId` inside its own `$transaction` via
 * `Promise.allSettled`, sharing prelude/postlude across bulkApprove and bulkReject.
 */
export async function processBulkApprovalSteps(
  ctx: {
    db: TenantScopedDb;
    organizationId: string;
    user?: { id?: string | null } | null;
  },
  stepIds: string[],
  perStep: (tx: TxClient, step: BulkStepRow) => Promise<void>,
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    stepIds.map(stepId =>
      ctx.db.$transaction(async tx => {
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
        await perStep(tx as TxClient, step);
      }),
    ),
  );

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
