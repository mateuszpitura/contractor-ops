// ---------------------------------------------------------------------------
// Phase 72 · COMPL-05 — Single payment-block guard.
// ---------------------------------------------------------------------------

import {
  evaluatePaymentEligibility,
  getDocumentTypeLabelKey,
  type PaymentEligibilityBlockedItem,
  type PaymentEligibilityContractorReason,
  type PaymentEligibilityItemReason,
  type PaymentEligibilityResult,
} from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { isPaymentBlockEnforced } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { writeAuditLog } from './audit-writer';

export interface PaymentGateClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
  };
}

type TxClient = PaymentGateClient;

const log = createLogger({ service: 'compliance-payment-gate' });

export type ItemReason = PaymentEligibilityItemReason;
export type ContractorReason = PaymentEligibilityContractorReason;
export type EligibilityResult = PaymentEligibilityResult;

export interface AssertOptions {
  /**
   * Tenant scope for the compliance read. REQUIRED — the where-clause always
   * filters items by `contractor.organizationId`, so a widened `contractorIds`
   * set (or an unscoped client) can never read another tenant's compliance
   * state. There is no all-tenant path: this gate is only ever evaluated for a
   * single org from session/tenant context.
   */
  organizationId: string;
  tx?: TxClient;
  throwOnFail?: boolean;
  flagEnabled?: boolean;
}

export async function assertContractorPaymentEligibility(
  contractorIds: string[],
  opts: AssertOptions,
): Promise<EligibilityResult> {
  const { tx, throwOnFail = true, flagEnabled, organizationId } = opts;
  const db: PaymentGateClient = tx ?? (prisma as unknown as PaymentGateClient);
  if (contractorIds.length === 0)
    return { blocked: false, wouldBlock: false, contractorReasons: [] };

  const items = (await db.contractorComplianceItem.findMany({
    where: {
      contractorId: { in: contractorIds },
      severity: 'BLOCKING',
      status: 'EXPIRED',
      contractor: { is: { organizationId } },
    },
    include: {
      contractor: { select: { id: true, displayName: true, organizationId: true } },
    },
  })) as PaymentEligibilityBlockedItem[];

  const enforce = flagEnabled ?? isPaymentBlockEnforced();
  const result = evaluatePaymentEligibility({ items, enforce });

  if (result.wouldBlock) {
    await recordWouldBlock(contractorIds, result.contractorReasons, organizationId);
  }

  if (result.blocked && throwOnFail) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.COMPLIANCE_PAYMENT_BLOCKED,
      cause: { contractorReasons: result.contractorReasons },
    });
  }

  return result;
}

async function recordWouldBlock(
  contractorIds: string[],
  contractorReasons: ContractorReason[],
  organizationId: string,
): Promise<void> {
  log.warn(
    { event: 'compliance.payment.would_block', contractorIds, contractorReasons, organizationId },
    'Compliance payment block (would-block, flag off)',
  );
  try {
    await writeAuditLog({
      organizationId,
      actorType: 'SYSTEM',
      action: 'compliance.payment.would_block',
      resourceType: 'PAYMENT_RUN',
      resourceId: contractorIds.join(','),
      metadata: { contractorReasons },
    });
  } catch (err) {
    log.error({ err }, 'compliance.payment.would_block audit-log write failed (non-blocking)');
  }
}

export { getDocumentTypeLabelKey };
