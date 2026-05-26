import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaClient } from '@contractor-ops/db/generated/prisma/client';
import {
  approvalAuditSystemLabel,
  approvalChainCreateSchema,
  approvalChainUpdateSchema,
  approvalQueueSchema,
  approveStepSchema,
  bulkApproveSchema,
  bulkRejectSchema,
  delegateStepSchema,
  rejectStepSchema,
  requestClarificationSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import type { TxClient } from '../../services/approval-engine';
import {
  advanceFlow,
  computeSlaStatus,
  createApprovalFlow,
  routeToChain,
} from '../../services/approval-engine';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, CacheTTL, cached, invalidate, invalidateByPrefix } from '../../services/cache';
import {
  syncApprovalSlaDeadline,
  syncPaymentDueDeadline,
} from '../../services/calendar-deadline-sync';
import { dispatch } from '../../services/notification-service';
import type { ApprovalQueueStepRow } from './approval-types';
import { approvalStepQueueInclude } from './approval-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Step validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates that an approval step is PENDING and assigned to the given user.
 * Throws appropriate TRPCErrors on failure. Caller is responsible for fetching
 * the step with the desired include/select to preserve Prisma types.
 */
function validateStepForAction(
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

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

/**
 * Dispatches an approval decision notification to the flow submitter.
 */
function dispatchDecisionNotification(
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
async function dispatchNextApproverNotification(
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
    body: `${contractor?.legalName ?? 'Unknown'} - ${(invoice.totalMinor / 100).toFixed(2)} ${invoice.currency}`,
    entityType: 'INVOICE',
    entityId: invoice.id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      contractorName: contractor?.legalName ?? 'Unknown',
      amount: (invoice.totalMinor / 100).toFixed(2),
      currency: invoice.currency,
      slaDeadline,
      invoiceId: invoice.id,
      flowId,
    },
  }).catch(_err => {
    /* fire-and-forget */
  });
}

// ---------------------------------------------------------------------------
// Audit trail helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether an approval step has breached its SLA deadline.
 */
function isSlaBreach(step: {
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
function buildAuditEvents(
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

  // System event: submitted
  events.push({
    type: 'system',
    label: 'submitted',
    timestamp: flow.startedAt.toISOString(),
  });

  // System event: routed to chain
  if (flow.chainConfigId) {
    events.push({
      type: 'system',
      label: 'routed',
      chainName: chainName ?? 'Unknown chain',
      timestamp: flow.startedAt.toISOString(),
    });
  }

  // Human decisions and SLA breach events
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

    // SLA breach detection
    if (isSlaBreach(step)) {
      events.push({
        type: 'system',
        label: approvalAuditSystemLabel.slaBreached,
        levelName: step.name,
        timestamp: (step.slaDeadline as Date).toISOString(),
      });
    }
  }

  // Flow completion event
  if (flow.completedAt) {
    events.push({
      type: 'system',
      label: flow.status === 'APPROVED' ? 'approved' : 'rejected',
      timestamp: flow.completedAt.toISOString(),
    });
  }

  // Sort by timestamp DESC (most recent first)
  events.sort(
    (a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime(),
  );

  return events;
}

/** WHERE fragments for raw SQL — must stay aligned with `where` below. */
function approvalQueueSqlConditions(
  organizationId: string,
  approverUserId: string | undefined,
  input: z.infer<typeof approvalQueueSchema>,
) {
  const conditions = [PrismaClient.sql`s."organizationId" = ${organizationId}`];
  if (input.tab === 'my' && approverUserId) {
    conditions.push(PrismaClient.sql`s."approverUserId" = ${approverUserId}`);
  }
  const now = new Date();
  if (input.status === 'pending') {
    conditions.push(PrismaClient.sql`s."status" = 'PENDING'::"ApprovalStatus"`);
  } else if (input.status === 'overdue') {
    conditions.push(PrismaClient.sql`s."status" = 'PENDING'::"ApprovalStatus"`);
    conditions.push(PrismaClient.sql`s."slaDeadline" < ${now}`);
  } else if (input.status === 'approved') {
    conditions.push(PrismaClient.sql`s."status" = 'APPROVED'::"ApprovalStatus"`);
  } else if (input.status === 'rejected') {
    conditions.push(PrismaClient.sql`s."status" = 'REJECTED'::"ApprovalStatus"`);
  }
  return conditions;
}

/**
 * After an approval flow completes, mark the invoice as approved and sync the
 * payment-due calendar deadline (D-07). Extracted to reduce cognitive complexity
 * of bulk-approve / single-approve handlers.
 */
async function finalizeApprovedInvoice(
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

// ---------------------------------------------------------------------------
// Bulk approval / rejection helper
// ---------------------------------------------------------------------------

type BulkStepRow = Prisma.ApprovalStepGetPayload<{ include: { approvalFlow: true } }>;

/**
 * Runs `perStep` for each `stepId` inside its own `$transaction` via
 * `Promise.allSettled`, sharing the prelude (load step + assignability guard)
 * and the postlude (succeeded/failed/errors aggregation + dashboard cache
 * invalidate) across bulkApprove and bulkReject. Each procedure only owns its
 * domain-specific writes.
 */
async function processBulkApprovalSteps(
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

// ---------------------------------------------------------------------------
// Approval router
// ---------------------------------------------------------------------------

export const approvalRouter = router({
  // =========================================================================
  // Chain Config CRUD (admin — settings permission)
  // =========================================================================

  /**
   * List all approval chain configs for the organization.
   */
  listChains: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return cached(
        CacheKeys.approvalChains(ctx.organizationId),
        CacheTTL.APPROVAL_CHAINS,
        async () => {
          const chains = await ctx.db.approvalChainConfig.findMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: 'INVOICE',
            },
            orderBy: { createdAt: 'asc' },
          });

          return plain(chains);
        },
      );
    }),

  /**
   * Get a single approval chain config by ID.
   */
  getChain: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const chain = await findOrThrow(
        () =>
          ctx.db.approvalChainConfig.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
            },
          }),
        E.APPROVAL_CHAIN_NOT_FOUND,
      );

      return plain(chain);
    }),

  /**
   * Create a new approval chain config.
   * If isDefault=true, unsets any existing default chain first.
   */
  createChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(approvalChainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const chain = await ctx.db.$transaction(async tx => {
        // If setting as default, unset existing default
        if (input.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: 'INVOICE',
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.create({
          data: {
            organizationId: ctx.organizationId,
            resourceType: 'INVOICE',
            name: input.name,
            isDefault: input.isDefault,
            conditionsJson: input.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(input.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      // F-OBS-05 — approval chain config drives who must sign off on
      // invoices; admin-controlled and audit-worthy.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_CREATE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: chain.id,
        resourceName: chain.name,
        newValues: {
          name: chain.name,
          isDefault: chain.isDefault,
          resourceType: chain.resourceType,
        },
      });

      return plain(chain);
    }),

  /**
   * Update an existing approval chain config.
   * If setting isDefault=true, unsets existing default first.
   */
  updateChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(approvalChainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updated = await ctx.db.$transaction(async tx => {
        // Verify chain belongs to org
        await findOrThrow(
          () =>
            tx.approvalChainConfig.findFirst({
              where: { id, organizationId: ctx.organizationId },
            }),
          E.APPROVAL_CHAIN_NOT_FOUND,
        );

        // If setting as default, unset existing default
        if (data.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: 'INVOICE',
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.update({
          where: { id },
          data: {
            name: data.name,
            isDefault: data.isDefault,
            isActive: data.isActive,
            conditionsJson: data.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(data.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      // F-OBS-05 — chain edits change which steps execute on every
      // future invoice; auditable.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_UPDATE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: updated.id,
        resourceName: updated.name,
        newValues: {
          name: updated.name,
          isDefault: updated.isDefault,
          isActive: updated.isActive,
        },
      });

      return plain(updated);
    }),

  /**
   * Delete an approval chain config.
   * Prevents deletion if active approval flows reference this chain.
   */
  deleteChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async tx => {
        // Verify chain belongs to org
        await findOrThrow(
          () =>
            tx.approvalChainConfig.findFirst({
              where: { id: input.id, organizationId: ctx.organizationId },
            }),
          E.APPROVAL_CHAIN_NOT_FOUND,
        );

        // Check for active flows referencing this chain
        const activeFlow = await tx.approvalFlow.findFirst({
          where: {
            chainConfigId: input.id,
            status: 'PENDING',
          },
        });

        if (activeFlow) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.APPROVAL_CHAIN_HAS_ACTIVE_FLOWS,
          });
        }

        await tx.approvalChainConfig.delete({ where: { id: input.id } });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      // F-OBS-05 — chain deletion silences future approvals; audit so the
      // gap can be retraced.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_DELETE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: input.id,
        metadata: { chainId: input.id },
      });

      return { success: true };
    }),

  // =========================================================================
  // Approval Queue
  // =========================================================================

  /**
   * List pending approval steps with invoice data and SLA status.
   * Supports "my" (assigned to current user) and "all" tabs.
   * Filters by status, search, and pagination.
   */
  listPending: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(approvalQueueSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApprovalStepWhereInput = {
        organizationId: ctx.organizationId,
      };

      // Tab filter
      if (input.tab === 'my') {
        where.approverUserId = ctx.user?.id;
      }

      // Status filter
      const now = new Date();
      if (input.status === 'pending') {
        where.status = 'PENDING';
      } else if (input.status === 'overdue') {
        where.status = 'PENDING';
        where.slaDeadline = { lt: now };
      } else if (input.status === 'approved') {
        where.status = 'APPROVED';
      } else if (input.status === 'rejected') {
        where.status = 'REJECTED';
      }
      // "all" — no additional status filter

      let steps: ApprovalQueueStepRow[];
      let total: number;

      if (input.sortBy === 'amount') {
        const sqlConditions = approvalQueueSqlConditions(ctx.organizationId, ctx.user?.id, input);
        const whereSql = PrismaClient.sql`WHERE ${PrismaClient.join(sqlConditions, ' AND ')}`;
        const orderDirSql =
          input.sortOrder === 'asc' ? PrismaClient.sql`ASC` : PrismaClient.sql`DESC`;
        const skip = (input.page - 1) * input.pageSize;

        const [idRows, totalCount] = await Promise.all([
          ctx.db.$queryRaw<Array<{ id: string }>>`
            SELECT s.id
            FROM "ApprovalStep" s
            INNER JOIN "ApprovalFlow" f ON f.id = s."approvalFlowId"
            LEFT JOIN "Invoice" i ON i.id = f."resourceId" AND f."resourceType" = 'INVOICE'::"EntityType"
            ${whereSql}
            ORDER BY COALESCE(i."amountToPayMinor", 0) ${orderDirSql}
            LIMIT ${input.pageSize} OFFSET ${skip}
          `,
          ctx.db.approvalStep.count({ where }),
        ]);

        total = totalCount;
        const ids = idRows.map(r => r.id);

        if (ids.length === 0) {
          return {
            items: [],
            total,
            page: input.page,
            pageSize: input.pageSize,
          };
        }

        const unordered = await ctx.db.approvalStep.findMany({
          where: { id: { in: ids } },
          include: approvalStepQueueInclude,
        });
        const order = new Map(ids.map((id, idx) => [id, idx]));
        steps = [...unordered].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      } else {
        const orderBy: Prisma.ApprovalStepOrderByWithRelationInput =
          input.sortBy === 'submitted'
            ? { approvalFlow: { startedAt: input.sortOrder } }
            : { slaDeadline: input.sortOrder };

        [steps, total] = await Promise.all([
          ctx.db.approvalStep.findMany({
            where,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy,
            include: approvalStepQueueInclude,
          }),
          ctx.db.approvalStep.count({ where }),
        ]);
      }

      // Batch-fetch invoice data for all steps
      const invoiceIds = [...new Set(steps.map(s => s.approvalFlow.resourceId))];

      const invoices = await ctx.db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          invoiceNumber: true,
          sellerName: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
          contractor: {
            select: { id: true, legalName: true },
          },
        },
      });

      const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));

      // Parse chain configs to get slaHours per step
      const chainConfigIds = [
        ...new Set(steps.map(s => s.approvalFlow.chainConfigId).filter(Boolean) as string[]),
      ];

      const chainConfigs =
        chainConfigIds.length > 0
          ? await ctx.db.approvalChainConfig.findMany({
              where: { id: { in: chainConfigIds } },
              select: { id: true, stepsJson: true },
            })
          : [];

      const chainConfigMap = new Map(chainConfigs.map(c => [c.id, c.stepsJson]));

      // Enrich steps with invoice data and SLA status
      const enrichedSteps = steps.map(step => {
        const invoice = invoiceMap.get(step.approvalFlow.resourceId);
        const chainSteps = step.approvalFlow.chainConfigId
          ? (chainConfigMap.get(step.approvalFlow.chainConfigId) as
              | Array<{ slaHours?: number }>
              | undefined)
          : undefined;
        const stepConfig = chainSteps?.[step.stepOrder - 1];
        const slaHours = stepConfig?.slaHours;

        return {
          ...step,
          invoice: invoice ?? null,
          slaStatus: computeSlaStatus(step.slaDeadline, step.status, slaHours),
        };
      });

      return {
        items: plain(enrichedSteps),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // =========================================================================
  // Approval Actions (all wrapped in ctx.db.$transaction)
  // =========================================================================

  /**
   * Approve an approval step.
   * Creates an ApprovalDecision, updates step to APPROVED,
   * advances flow to next step, and updates invoice if flow completes.
   */
  approve: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(approveStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
          include: { approvalFlow: true },
        });
        validateStepForAction(step, ctx.user?.id);

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'APPROVE',
            comment: input.comment ?? null,
          },
        });

        // Update step
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'APPROVED',
            actedAt: new Date(),
            decision: 'APPROVE',
            comment: input.comment ?? null,
          },
        });

        // Advance flow
        const advanceResult = await advanceFlow(tx as TxClient, step.approvalFlowId);

        // If flow completed, update invoice status and payment status
        if (advanceResult.completed) {
          await tx.invoice.update({
            where: { id: step.approvalFlow.resourceId },
            data: {
              status: 'APPROVED',
              paymentStatus: 'READY',
              readyForPaymentAt: new Date(),
            },
          });
        }

        // Fetch data needed for notifications
        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: {
            id: true,
            invoiceNumber: true,
            totalMinor: true,
            currency: true,
            contractorId: true,
            dueDate: true,
          },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { id: true, createdByUserId: true, steps: { orderBy: { stepOrder: 'asc' } } },
        });

        return { updatedStep, advanceResult, invoice, flow };
      });

      // Fire-and-forget: dispatch APPROVAL_DECISION to the user who submitted
      dispatchDecisionNotification(
        ctx.organizationId,
        'approved',
        result.invoice,
        result.flow?.createdByUserId,
        ctx.user?.name ?? 'approver',
      );

      // If flow advanced to next step, dispatch APPROVAL_REQUEST to next approver
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
            ctx.db,
            ctx.organizationId,
            result.invoice,
            result.flow.id,
            nextStep,
          );
        }
      }

      // Calendar auto-push: sync payment deadline when invoice fully approved (D-07)
      if (result.advanceResult.completed && result.invoice?.dueDate) {
        const contractor = result.invoice.contractorId
          ? await ctx.db.contractor.findUnique({
              where: { id: result.invoice.contractorId },
              select: { displayName: true },
            })
          : null;
        void syncPaymentDueDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber ?? `INV-${result.invoice.id.slice(-6)}`,
          contractorName: contractor?.displayName ?? 'Unknown',
          dueDate: new Date(result.invoice.dueDate),
          userId: ctx.user?.id,
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result.updatedStep);
    }),

  /**
   * Reject an approval step.
   * Creates a REJECT decision, marks step and flow as REJECTED,
   * and updates invoice status to REJECTED. Does NOT advance flow.
   */
  reject: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(rejectStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
          include: { approvalFlow: true },
        });
        validateStepForAction(step, ctx.user?.id);

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        // Update step
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'REJECTED',
            actedAt: new Date(),
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        // Mark flow as REJECTED — do NOT advance
        await tx.approvalFlow.update({
          where: { id: step.approvalFlowId },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
          },
        });

        // Update invoice status
        await tx.invoice.update({
          where: { id: step.approvalFlow.resourceId },
          data: { status: 'REJECTED' },
        });

        // Fetch data for notification
        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: { id: true, invoiceNumber: true },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { createdByUserId: true },
        });

        return { updatedStep, invoice, flow };
      });

      // Fire-and-forget: dispatch APPROVAL_DECISION (rejected) to submitter
      dispatchDecisionNotification(
        ctx.organizationId,
        'rejected',
        result.invoice,
        result.flow?.createdByUserId,
        ctx.user?.name ?? 'approver',
        input.comment,
      );

      return plain(result.updatedStep);
    }),

  /**
   * Delegate an approval step to another user.
   * Creates a DELEGATE decision and updates the step's approverUserId.
   * Step remains PENDING (SLA continues per D-10).
   */
  delegate: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(delegateStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
        });
        validateStepForAction(step, ctx.user?.id);

        // Verify delegate user exists in the organization
        const delegateMember = await tx.member.findFirst({
          where: {
            organizationId: ctx.organizationId,
            userId: input.delegateToUserId,
          },
        });

        if (!delegateMember) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.APPROVAL_DELEGATE_NOT_MEMBER,
          });
        }

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'DELEGATE',
            comment: input.comment ?? null,
          },
        });

        // Update step — reassign approver, keep PENDING
        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            approverUserId: input.delegateToUserId,
          },
        });

        return updatedStep;
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result);
    }),

  /**
   * Request clarification on an approval step.
   * Creates a REQUEST_CHANGES decision. Step remains PENDING.
   */
  requestClarification: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(requestClarificationSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
        });
        validateStepForAction(step, ctx.user?.id);

        // Create decision record
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REQUEST_CHANGES',
            comment: input.comment,
          },
        });

        return step;
      });

      return plain(result);
    }),

  // =========================================================================
  // Bulk Actions
  // =========================================================================

  /**
   * Bulk approve multiple approval steps.
   * Processes each step individually via Promise.allSettled.
   * Returns success/failure counts and error details.
   */
  bulkApprove: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(bulkApproveSchema)
    .mutation(({ ctx, input }) =>
      processBulkApprovalSteps(ctx, input.stepIds, async (tx, step) => {
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'APPROVE',
          },
        });

        await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'APPROVED',
            actedAt: new Date(),
            decision: 'APPROVE',
          },
        });

        const advanceResult = await advanceFlow(tx, step.approvalFlowId);

        if (advanceResult.completed) {
          await finalizeApprovedInvoice(tx, {
            resourceId: step.approvalFlow.resourceId,
            organizationId: ctx.organizationId,
            db: ctx.db,
            userId: ctx.user?.id,
          });
        }
      }),
    ),

  /**
   * Bulk reject multiple approval steps with a shared comment.
   * Processes each step individually via Promise.allSettled.
   */
  bulkReject: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(bulkRejectSchema)
    .mutation(({ ctx, input }) =>
      processBulkApprovalSteps(ctx, input.stepIds, async (tx, step) => {
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'REJECTED',
            actedAt: new Date(),
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        await tx.approvalFlow.update({
          where: { id: step.approvalFlowId },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: step.approvalFlow.resourceId },
          data: { status: 'REJECTED' },
        });
      }),
    ),

  // =========================================================================
  // Submit for Approval
  // =========================================================================

  /**
   * Submit an invoice for approval routing.
   * Finds matching chain config, creates approval flow with snapshotted steps,
   * and updates invoice status to APPROVAL_PENDING.
   */
  submitForApproval: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flow = await ctx.db.$transaction(async tx => {
        const invoice = await findOrThrow(
          () =>
            tx.invoice.findFirst({
              where: {
                id: input.invoiceId,
                organizationId: ctx.organizationId,
                deletedAt: null,
              },
            }),
          E.INVOICE_NOT_FOUND,
        );

        // Verify invoice is in a state that allows submission
        const allowedMatchStatuses = ['MATCHED', 'MANUALLY_CONFIRMED'];
        if (!allowedMatchStatuses.includes(invoice.matchStatus)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invoice must be matched or manually confirmed before submitting for approval',
          });
        }

        if (invoice.status === 'APPROVAL_PENDING') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_ALREADY_PENDING,
          });
        }

        // Route to appropriate chain
        const chainConfig = await routeToChain(tx as TxClient, ctx.organizationId, {
          totalMinor: invoice.totalMinor,
        });

        if (!chainConfig) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No approval chain configured for this organization',
          });
        }

        // Create approval flow with snapshotted steps
        const approvalFlow = await createApprovalFlow(tx as TxClient, {
          organizationId: ctx.organizationId,
          resourceType: 'INVOICE',
          resourceId: invoice.id,
          chainConfig,
          createdByUserId: ctx.user?.id,
        });

        // Update invoice status
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'APPROVAL_PENDING' },
        });

        return { approvalFlow, invoice };
      });

      // Fire-and-forget: dispatch APPROVAL_REQUEST to first approver
      const firstStep = await ctx.db.approvalStep.findFirst({
        where: { approvalFlowId: flow.approvalFlow.id, organizationId: ctx.organizationId },
        orderBy: { stepOrder: 'asc' },
      });
      if (firstStep?.approverUserId) {
        const inv = flow.invoice;
        // Fetch contractor name for notification metadata
        const contractor = inv.contractorId
          ? await ctx.db.contractor.findUnique({
              where: { id: inv.contractorId },
              select: { legalName: true },
            })
          : null;

        const slaDeadline = firstStep.slaDeadline
          ? new Date(firstStep.slaDeadline).toISOString()
          : '';

        dispatch({
          organizationId: ctx.organizationId,
          type: 'APPROVAL_REQUEST',
          recipientUserIds: [firstStep.approverUserId],
          title: `Approval requested for ${inv.invoiceNumber}`,
          body: `${contractor?.legalName ?? 'Unknown'} - ${(inv.totalMinor / 100).toFixed(2)} ${inv.currency}. SLA: ${slaDeadline}`,
          entityType: 'INVOICE',
          entityId: inv.id,
          metadata: {
            invoiceNumber: inv.invoiceNumber,
            contractorName: contractor?.legalName ?? 'Unknown',
            amount: (inv.totalMinor / 100).toFixed(2),
            currency: inv.currency,
            slaDeadline,
            invoiceId: inv.id,
            flowId: flow.approvalFlow.id,
          },
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      // Calendar auto-push: sync approval SLA deadline (D-09)
      if (firstStep?.slaDeadline) {
        void syncApprovalSlaDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          approvalFlowId: flow.approvalFlow.id,
          itemType: 'Invoice',
          itemName: flow.invoice.invoiceNumber ?? `INV-${flow.invoice.id.slice(-6)}`,
          deadline: new Date(firstStep.slaDeadline),
          userId: ctx.user?.id,
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      return plain(flow.approvalFlow);
    }),

  // =========================================================================
  // Audit Trail
  // =========================================================================

  /**
   * Get the approval audit trail for an invoice.
   * Combines human decisions with derived system events (submitted, routed, SLA breaches).
   * Events sorted by timestamp DESC (most recent first).
   */
  getAuditTrail: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const flow = await ctx.db.approvalFlow.findFirst({
        where: {
          resourceId: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              decisions: {
                include: {
                  actor: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });

      if (!flow) {
        return { events: [] as Record<string, unknown>[], flow: null };
      }

      // Resolve chain name for the flow
      let chainName: string | null = null;
      if (flow.chainConfigId) {
        const cfg = await ctx.db.approvalChainConfig.findUnique({
          where: { id: flow.chainConfigId },
          select: { name: true },
        });
        chainName = cfg?.name ?? null;
      }

      // Build flow summary with step data for chain tracker
      const resolvedSteps = await Promise.all(
        flow.steps.map(async step => ({
          id: step.id,
          stepOrder: step.stepOrder,
          name: step.name,
          status: step.status,
          approverUserId: step.approverUserId,
          approverRole: step.approverRole,
          slaDeadline: step.slaDeadline?.toISOString() ?? null,
          actedAt: step.actedAt?.toISOString() ?? null,
          decision: step.decision ?? null,
          approver: step.approverUserId
            ? await ctx.db.user.findUnique({
                where: { id: step.approverUserId },
                select: { id: true, name: true, email: true, image: true },
              })
            : null,
        })),
      );

      const flowSummary = {
        id: flow.id,
        status: flow.status,
        chainName,
        currentStepOrder: flow.currentStepOrder,
        steps: resolvedSteps,
      };

      const events = buildAuditEvents(flow, chainName);

      return plain({ events, flow: flowSummary });
    }),
});
