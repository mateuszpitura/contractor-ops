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
import type { AuditEntityType, AuditWriterClient } from './audit-writer';
import { writeAuditLog } from './audit-writer';
import type { PaymentGateClient } from './compliance-payment-gate';
import { assertContractorPaymentEligibility } from './compliance-payment-gate';

// Renewal-reset listener lives in the reminder-scan service; re-export for a single
// import surface from the classification listeners.
// biome-ignore lint/performance/noBarrelFile: not a barrel — recovery service module; single re-export for a unified import surface
export { onComplianceItemExpiresAtChanged } from './compliance-reminder-scan';

const log = createLogger({ service: 'compliance-recovery' });

/**
 * Structural client interface — satisfied by the full PrismaClient, a `$transaction`
 * tx, AND the tenant-scoped extended client. Loose `Promise<unknown>` returns avoid
 * the deep-generic instantiation the concrete client union triggers. Extends
 * PaymentGateClient so the same tx can be forwarded to the eligibility re-assertion.
 */
export interface RecoveryClient extends PaymentGateClient, AuditWriterClient {
  // biome-ignore lint/suspicious/noExplicitAny: $queryRaw tagged-template signature is intentionally loose
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: any[]) => Promise<T>;
  approvalFlow: {
    update: (args: Prisma.ApprovalFlowUpdateArgs) => Promise<unknown>;
  };
}

interface SatisfiedArgs {
  itemId: string;
  contractorId: string;
  organizationId: string;
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
    await tx.approvalFlow.update({
      where: { id: flow.id },
      data: { status: 'PENDING', complianceHoldsJson: PrismaRuntime.DbNull },
    });
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
