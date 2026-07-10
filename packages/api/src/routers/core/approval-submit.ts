import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import type { ComplianceHold, TxClient } from '../../services/approval-engine';
import { createApprovalFlow, routeToChain } from '../../services/approval-engine';
import { writeAuditLog } from '../../services/audit-writer';
import { syncApprovalSlaDeadline } from '../../services/calendar-deadline-sync';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import { resumeApprovalFlowFromCompliance } from '../../services/compliance-recovery';
import type { OutboxTransactionalClient } from '../../services/outbox';
import { enqueueNotificationOutboxEvent } from '../../services/outbox';
import { buildAuditEvents, plain } from './approval-shared';

const SUBMITTABLE_INVOICE_STATUSES = new Set(['RECEIVED', 'UNDER_REVIEW', 'REJECTED']);

const PAYMENT_PIPELINE_BLOCKING_STATUSES = new Set(['READY', 'IN_RUN', 'PAID', 'PARTIALLY_PAID']);

/**
 * Enqueue the APPROVAL_REQUEST notification for the first approver INSIDE the
 * caller's transaction, so the send commits atomically with the flow + the
 * invoice status flip and is delivered exactly-once by the outbox drain.
 * No-op when the first step has no assigned approver.
 */
async function enqueueApprovalRequestNotification(
  tx: TxClient,
  input: {
    organizationId: string;
    flowId: string;
    firstStep: { id: string; approverUserId: string | null; slaDeadline: Date | null } | null;
    invoice: {
      id: string;
      invoiceNumber: string | null;
      contractorId: string | null;
      totalMinor: number;
      currency: string;
    };
  },
): Promise<void> {
  const { firstStep, invoice } = input;
  if (!firstStep?.approverUserId) return;

  const contractor = invoice.contractorId
    ? await tx.contractor.findUnique({
        where: { id: invoice.contractorId },
        select: { legalName: true },
      })
    : null;
  const slaDeadline = firstStep.slaDeadline ? new Date(firstStep.slaDeadline).toISOString() : '';
  const amount = minorToMajor(invoice.totalMinor, invoice.currency).toFixed(
    minorUnitDigits(invoice.currency),
  );

  await enqueueNotificationOutboxEvent({
    tx: tx as unknown as OutboxTransactionalClient,
    event: {
      organizationId: input.organizationId,
      type: 'APPROVAL_REQUEST',
      recipientUserIds: [firstStep.approverUserId],
      title: `Approval requested for ${invoice.invoiceNumber}`,
      body: `${contractor?.legalName ?? 'Unknown'} - ${amount} ${invoice.currency}. SLA: ${slaDeadline}`,
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        contractorName: contractor?.legalName ?? 'Unknown',
        amount,
        currency: invoice.currency,
        slaDeadline,
        invoiceId: invoice.id,
        flowId: input.flowId,
      },
    },
    dedupKey: `approval-request:${firstStep.id}`,
  });
}

export const approvalSubmitRouter = router({
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

        const allowedMatchStatuses = ['MATCHED', 'MANUALLY_CONFIRMED'];
        if (!allowedMatchStatuses.includes(invoice.matchStatus)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_MUST_BE_MATCHED,
          });
        }

        if (invoice.status === 'APPROVAL_PENDING') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_ALREADY_PENDING,
          });
        }

        if (!SUBMITTABLE_INVOICE_STATUSES.has(invoice.status)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_NOT_SUBMITTABLE,
          });
        }

        if (PAYMENT_PIPELINE_BLOCKING_STATUSES.has(invoice.paymentStatus)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_NOT_SUBMITTABLE,
          });
        }

        const chainConfig = await routeToChain(tx as TxClient, ctx.organizationId, {
          totalMinor: invoice.totalMinor,
        });

        if (!chainConfig) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.APPROVAL_NO_CHAIN_CONFIGURED,
          });
        }

        const approvalFlow = await createApprovalFlow(tx as TxClient, {
          organizationId: ctx.organizationId,
          resourceType: 'INVOICE',
          resourceId: invoice.id,
          chainConfig,
          createdByUserId: ctx.user?.id,
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'APPROVAL_PENDING',
            paymentStatus: 'NOT_READY',
            readyForPaymentAt: null,
          },
        });

        // The first step was just created by createApprovalFlow inside this
        // tx, so it is visible here. Enqueue the approval-request
        // notification INSIDE the tx (see helper) so it commits atomically
        // with the flow + the invoice status flip and is delivered
        // exactly-once by the outbox drain — not post-commit fire-and-forget.
        const firstStep = await tx.approvalStep.findFirst({
          where: { approvalFlowId: approvalFlow.id, organizationId: ctx.organizationId },
          orderBy: { stepOrder: 'asc' },
        });

        await enqueueApprovalRequestNotification(tx as TxClient, {
          organizationId: ctx.organizationId,
          flowId: approvalFlow.id,
          firstStep,
          invoice,
        });

        return { approvalFlow, invoice, firstStep };
      });

      const firstStep = flow.firstStep;
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

      let chainName: string | null = null;
      if (flow.chainConfigId) {
        const cfg = await ctx.db.approvalChainConfig.findUnique({
          where: { id: flow.chainConfigId },
          select: { name: true },
        });
        chainName = cfg?.name ?? null;
      }

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

  listComplianceHeld: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(
      z.object({
        tab: z.enum(['my', 'all']).default('my'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const flows = await ctx.db.approvalFlow.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'PENDING_COMPLIANCE',
          resourceType: 'INVOICE',
        },
        orderBy: { startedAt: 'desc' },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              approver: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const userId = ctx.user?.id;
      const visible =
        input.tab === 'my' && userId
          ? flows.filter(flow => {
              const lastApproved = [...flow.steps].reverse().find(s => s.status === 'APPROVED');
              return lastApproved?.approverUserId === userId;
            })
          : flows;

      const invoiceIds = visible.map(f => f.resourceId);
      const invoices =
        invoiceIds.length > 0
          ? await ctx.db.invoice.findMany({
              where: { id: { in: invoiceIds }, organizationId: ctx.organizationId },
              select: {
                id: true,
                invoiceNumber: true,
                totalMinor: true,
                currency: true,
                contractor: { select: { id: true, legalName: true } },
              },
            })
          : [];
      const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));

      const items = visible.map(flow => {
        const hold = flow.complianceHoldsJson as ComplianceHold | null;
        const lastApproved = [...flow.steps].reverse().find(s => s.status === 'APPROVED');
        return {
          approvalFlowId: flow.id,
          resourceId: flow.resourceId,
          heldAt: hold?.heldAt ?? null,
          heldItemIds: hold?.itemIds ?? [],
          heldByOperator: hold?.heldByOperator ?? null,
          lastApprover: lastApproved?.approver ?? null,
          invoice: invoiceMap.get(flow.resourceId) ?? null,
        };
      });

      return plain({ items, total: items.length });
    }),

  resumeFromCompliance: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(
      z.object({
        approvalFlowId: z.string().cuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const flow = await tx.approvalFlow.findUniqueOrThrow({
          where: { id: input.approvalFlowId },
          select: {
            id: true,
            organizationId: true,
            status: true,
            resourceType: true,
            resourceId: true,
          },
        });
        if (flow.organizationId !== ctx.organizationId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.APPROVAL_FLOW_NOT_FOUND });
        }
        if (flow.status !== 'PENDING_COMPLIANCE') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.APPROVAL_NOT_PENDING_COMPLIANCE,
          });
        }

        let contractorId: string | null = null;
        if (flow.resourceType === 'INVOICE') {
          const inv = await tx.invoice.findUniqueOrThrow({
            where: { id: flow.resourceId },
            select: { contractorId: true },
          });
          contractorId = inv.contractorId;
        }
        if (!contractorId) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.APPROVAL_CANNOT_RESOLVE_CONTRACTOR,
          });
        }

        const eligibility = await assertContractorPaymentEligibility([contractorId], {
          tx,
          throwOnFail: false,
          organizationId: ctx.organizationId,
        });
        if (eligibility.blocked) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.APPROVAL_STILL_COMPLIANCE_BLOCKED,
            cause: { contractorReasons: eligibility.contractorReasons },
          });
        }

        const resumeResult = await resumeApprovalFlowFromCompliance(tx as TxClient, {
          flowId: input.approvalFlowId,
          organizationId: ctx.organizationId,
        });
        if (!resumeResult.reopenedStepId) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.APPROVAL_COMPLIANCE_RESUME_NO_STEP,
          });
        }
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'approval.compliance_resolved',
          resourceType: flow.resourceType,
          resourceId: flow.resourceId,
          metadata: {
            manualOverride: true,
            reason: input.reason,
            resolverEvent: 'admin_manual',
          },
          tx,
        });
        return { resumed: true, approvalFlowId: input.approvalFlowId, resumeResult };
      });

      if (result.resumeResult.slaDeadline && result.resumeResult.resourceType === 'INVOICE') {
        const invoice = await ctx.db.invoice.findUnique({
          where: { id: result.resumeResult.resourceId },
          select: { invoiceNumber: true },
        });
        if (invoice) {
          void syncApprovalSlaDeadline(ctx.db, {
            organizationId: ctx.organizationId,
            approvalFlowId: input.approvalFlowId,
            itemType: 'Invoice',
            itemName: invoice.invoiceNumber ?? `INV-${result.resumeResult.resourceId.slice(-6)}`,
            deadline: new Date(result.resumeResult.slaDeadline),
            userId: ctx.user?.id,
          }).catch(_err => {
            /* fire-and-forget */
          });
        }
      }

      return plain({ resumed: result.resumed, approvalFlowId: result.approvalFlowId });
    }),
});
