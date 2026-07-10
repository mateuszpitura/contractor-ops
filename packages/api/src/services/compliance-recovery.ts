// Recovery hooks for PENDING_COMPLIANCE approval flows.
//
// When a held ContractorComplianceItem flips to SATISFIED, onComplianceItemSatisfied
// finds every PENDING_COMPLIANCE flow whose complianceHoldsJson @> { itemIds: [<id>] }
// and re-asserts eligibility. Flows that now PASS transition back to PENDING (never
// auto-APPROVE — an approver must still act); flows still blocked by OTHER items stay
// held (the eligibility re-assertion enforces the "all holding items satisfied" rule).

import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaRuntime } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import type { ComplianceHold, TxClient } from './approval-engine';
import type { AuditEntityType, AuditWriterClient } from './audit-writer';
import { writeAuditLog } from './audit-writer';
import type { PaymentGateClient } from './compliance-payment-gate';
import { assertContractorPaymentEligibility } from './compliance-payment-gate';
import type { OutboxTransactionalClient } from './outbox';
import { enqueueNotificationOutboxEvent } from './outbox';

// Renewal-reset listener lives in its own module (import-cycle break); re-export
// for a single import surface from the classification listeners.
// biome-ignore lint/performance/noBarrelFile: not a barrel — recovery service module; single re-export for a unified import surface
export { onComplianceItemExpiresAtChanged } from './compliance-reminder-reset';

const log = createLogger({ service: 'compliance-recovery' });

/**
 * Structural client interface — satisfied by the full PrismaClient, a `$transaction`
 * tx, AND the tenant-scoped extended client. Loose `Promise<unknown>` returns avoid
 * the deep-generic instantiation the concrete client union triggers. Extends
 * PaymentGateClient so the same tx can be forwarded to the eligibility re-assertion.
 */
export interface RecoveryClient extends PaymentGateClient, AuditWriterClient {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  approvalFlow: {
    update: (args: Prisma.ApprovalFlowUpdateArgs) => Promise<unknown>;
  };
}

interface SatisfiedArgs {
  itemId: string;
  contractorId: string;
  organizationId: string;
}

interface StepConfig {
  slaHours: number;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

export interface ComplianceResumeResult {
  reopenedStepId: string | null;
  slaDeadline: Date | null;
  resourceType: string;
  resourceId: string;
}

/**
 * Releases a PENDING_COMPLIANCE flow back to PENDING by re-opening the final
 * approver step (fresh SLA) and enqueueing an APPROVAL_REQUEST notification.
 */
export async function resumeApprovalFlowFromCompliance(
  tx: TxClient,
  args: { flowId: string; organizationId: string },
): Promise<ComplianceResumeResult> {
  const flow = await tx.approvalFlow.findUniqueOrThrow({
    where: { id: args.flowId },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
    },
  });

  const stepOrder = flow.currentStepOrder ?? flow.steps.length;
  const stepToReopen =
    flow.steps.find(s => s.stepOrder === stepOrder && s.status === 'APPROVED') ??
    [...flow.steps].reverse().find(s => s.status === 'APPROVED') ??
    null;

  let slaHours = 24;
  if (flow.chainConfigId && stepToReopen) {
    const chainConfig = await tx.approvalChainConfig.findUnique({
      where: { id: flow.chainConfigId },
      select: { stepsJson: true },
    });
    if (chainConfig) {
      const chainSteps = chainConfig.stepsJson as unknown as StepConfig[];
      slaHours = chainSteps[stepToReopen.stepOrder - 1]?.slaHours ?? 24;
    }
  }

  const now = new Date();
  const slaDeadline = stepToReopen ? addHours(now, slaHours) : null;

  if (!stepToReopen) {
    log.warn(
      { flowId: args.flowId },
      'compliance-recovery: cannot resume — no approver step to reopen; flow stays PENDING_COMPLIANCE',
    );
    return {
      reopenedStepId: null,
      slaDeadline: null,
      resourceType: flow.resourceType,
      resourceId: flow.resourceId,
    };
  }

  const holdCycleKey =
    (flow.complianceHoldsJson as ComplianceHold | null)?.heldAt ?? now.toISOString();

  await tx.approvalFlow.update({
    where: { id: args.flowId },
    data: { status: 'PENDING', complianceHoldsJson: PrismaRuntime.DbNull },
  });

  if (slaDeadline) {
    await tx.approvalStep.update({
      where: { id: stepToReopen.id },
      data: {
        status: 'PENDING',
        actedAt: null,
        decision: null,
        comment: null,
        slaDeadline,
      },
    });

    if (flow.resourceType === 'INVOICE' && stepToReopen.approverUserId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: flow.resourceId },
        select: {
          id: true,
          invoiceNumber: true,
          contractorId: true,
          totalMinor: true,
          currency: true,
        },
      });
      if (invoice) {
        const contractor = invoice.contractorId
          ? await tx.contractor.findUnique({
              where: { id: invoice.contractorId },
              select: { legalName: true },
            })
          : null;
        const slaIso = slaDeadline.toISOString();
        const amount = minorToMajor(invoice.totalMinor, invoice.currency).toFixed(
          minorUnitDigits(invoice.currency),
        );

        await enqueueNotificationOutboxEvent({
          tx: tx as unknown as OutboxTransactionalClient,
          event: {
            organizationId: args.organizationId,
            type: 'APPROVAL_REQUEST',
            recipientUserIds: [stepToReopen.approverUserId],
            title: `Approval requested for ${invoice.invoiceNumber}`,
            body: `${contractor?.legalName ?? 'Unknown'} - ${amount} ${invoice.currency}. Compliance hold cleared. SLA: ${slaIso}`,
            entityType: 'INVOICE',
            entityId: invoice.id,
            metadata: {
              invoiceNumber: invoice.invoiceNumber,
              contractorName: contractor?.legalName ?? 'Unknown',
              amount,
              currency: invoice.currency,
              slaDeadline: slaIso,
              invoiceId: invoice.id,
              flowId: args.flowId,
              complianceResume: true,
            },
          },
          dedupKey: `approval-request:compliance-resume:${args.flowId}:${holdCycleKey}`,
        });
      }
    }
  }

  return {
    reopenedStepId: stepToReopen.id,
    slaDeadline,
    resourceType: flow.resourceType,
    resourceId: flow.resourceId,
  };
}

export async function onComplianceItemSatisfied(
  tx: RecoveryClient,
  args: SatisfiedArgs,
): Promise<{ resumedFlowIds: string[] }> {
  // GIN-indexed JSONB containment query. The itemIds payload is passed
  // as a bound text parameter and cast to jsonb in SQL — no string interpolation.
  const containment = JSON.stringify({ itemIds: [args.itemId] });
  const heldFlows = await tx.$queryRaw<
    Array<{ id: string; resourceType: string; resourceId: string }>
  >`
    SELECT id, "resourceType", "resourceId" FROM "ApprovalFlow"
    WHERE "status" = 'PENDING_COMPLIANCE'
      AND "organizationId" = ${args.organizationId}
      AND "complianceHoldsJson" @> ${containment}::jsonb
  `;

  const resumedFlowIds: string[] = [];
  for (const flow of heldFlows) {
    const eligibility = await assertContractorPaymentEligibility([args.contractorId], {
      tx,
      throwOnFail: false,
      organizationId: args.organizationId,
    });
    if (eligibility.blocked) {
      log.info(
        {
          flowId: flow.id,
          contractorId: args.contractorId,
          remainingReasons: eligibility.contractorReasons,
        },
        'compliance-recovery: flow remains held — other items still block',
      );
      continue;
    }
    const resumeResult = await resumeApprovalFlowFromCompliance(tx as unknown as TxClient, {
      flowId: flow.id,
      organizationId: args.organizationId,
    });
    if (!resumeResult.reopenedStepId) continue;
    await writeAuditLog({
      organizationId: args.organizationId,
      actorType: 'SYSTEM',
      action: 'approval.compliance_resolved',
      // Use the flow's actual resourceType/resourceId so both resolution paths
      // (system recovery here and admin manual in approval.ts:1506) emit
      // identically-shaped audit rows. Previously hardcoded 'INVOICE'/flow.id
      // was semantically wrong — a flow id is not an invoice resource id.
      // Cast: $queryRaw returns plain string; DB enforces the EntityType enum.
      resourceType: flow.resourceType as AuditEntityType,
      resourceId: flow.resourceId,
      metadata: {
        releasedItemIds: [args.itemId],
        resolverEvent: 'item_satisfied',
        timestamp: new Date().toISOString(),
      },
      tx,
    });
    resumedFlowIds.push(flow.id);
  }

  if (resumedFlowIds.length > 0) {
    log.info(
      { resumedFlowIds, triggerItemId: args.itemId },
      'compliance-recovery: released held approvals',
    );
  }
  return { resumedFlowIds };
}
