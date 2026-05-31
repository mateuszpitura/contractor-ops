// ---------------------------------------------------------------------------
// Phase 72 · COMPL-05 — Single payment-block guard.
// ---------------------------------------------------------------------------
//
// Called from EVERY payment-write entry point:
//   - payment.create (Plan 72-04 — this plan)
//   - payment.lockAndExport (Plan 72-06 — also re-asserts inside the export tx for TOCTOU defence)
//
// CI lint guard `payment-gate-guard` enforces this helper's presence in every
// payment-write procedure (payment.create, payment.lockAndExport). NO new entry
// point ships without also importing this helper.
//
// Feature flag `compliance-payment-block`:
//   - ON  → throws PRECONDITION_FAILED with structured `cause` (D-10 shape)
//   - OFF → returns { blocked: false, wouldBlock: true } + WARN log + AuditLog
//
// `FLAG_SIGNOFF_BYPASS=local` (engineer dev env) forces the flag ON regardless
// of the registry's PENDING status — the canonical dev-time hard-block path
// until legal sign-off flips the flag.

import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { isPaymentBlockEnforced } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';

type TxClient = Prisma.TransactionClient;

const log = createLogger({ service: 'compliance-payment-gate' });

export interface ItemReason {
  itemId: string;
  policyRuleId: string | null;
  documentTypeLabelKey: string;
  expiredOnDate: string; // YYYY-MM-DD in jurisdiction TZ
  jurisdictionTz: string;
  deepLinkPath: string;
}

export interface ContractorReason {
  contractorId: string;
  contractorName: string;
  reasons: ItemReason[];
}

export interface EligibilityResult {
  blocked: boolean;
  wouldBlock: boolean;
  contractorReasons: ContractorReason[];
}

export interface AssertOptions {
  tx?: TxClient;
  throwOnFail?: boolean; // default: true
  flagEnabled?: boolean; // override for tests; default: from registry
  organizationId?: string; // required when flag-OFF audit-log writes happen
}

const EMPTY_RESULT: EligibilityResult = {
  blocked: false,
  wouldBlock: false,
  contractorReasons: [],
};

export async function assertContractorPaymentEligibility(
  contractorIds: string[],
  opts: AssertOptions = {},
): Promise<EligibilityResult> {
  const { tx, throwOnFail = true, flagEnabled, organizationId } = opts;
  const db = tx ?? prisma;
  if (contractorIds.length === 0) return EMPTY_RESULT;

  const items = await db.contractorComplianceItem.findMany({
    where: {
      contractorId: { in: contractorIds },
      severity: 'BLOCKING',
      status: 'EXPIRED',
    },
    include: {
      contractor: { select: { id: true, displayName: true, organizationId: true } },
    },
  });

  const contractorReasons = groupReasons(items);
  const enforce = flagEnabled ?? isPaymentBlockEnforced();
  const blocked = enforce && contractorReasons.length > 0;
  const wouldBlock = !enforce && contractorReasons.length > 0;

  if (wouldBlock) {
    await recordWouldBlock(
      db,
      contractorIds,
      contractorReasons,
      organizationId ?? items[0]?.contractor.organizationId,
    );
  }

  if (blocked && throwOnFail) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.COMPLIANCE_PAYMENT_BLOCKED,
      cause: { contractorReasons },
    });
  }

  return { blocked, wouldBlock, contractorReasons };
}

type ComplianceItemWithContractor = {
  id: string;
  contractorId: string;
  policyRuleId: string | null;
  documentType: string;
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  contractor: { id: string; displayName: string; organizationId: string };
};

function groupReasons(items: ComplianceItemWithContractor[]): ContractorReason[] {
  const grouped = new Map<string, ContractorReason>();
  for (const item of items) {
    let cr = grouped.get(item.contractorId);
    if (!cr) {
      cr = {
        contractorId: item.contractorId,
        contractorName: item.contractor.displayName,
        reasons: [],
      };
      grouped.set(item.contractorId, cr);
    }
    cr.reasons.push({
      itemId: item.id,
      policyRuleId: item.policyRuleId,
      documentTypeLabelKey: getDocumentTypeLabelKey(item.documentType, item.policyRuleId),
      expiredOnDate: item.expiresAt ? item.expiresAt.toISOString().slice(0, 10) : 'unknown',
      jurisdictionTz: item.expiryJurisdictionTz ?? 'UTC',
      deepLinkPath: `/contractors/${item.contractorId}/compliance#item-${item.id}`,
    });
  }
  return Array.from(grouped.values());
}

/**
 * Flag-OFF "would-block" recording — a structured WARN log (always) plus a
 * best-effort AuditLog row (never aborts the caller). T-72-04-07.
 */
async function recordWouldBlock(
  db: TxClient | typeof prisma,
  contractorIds: string[],
  contractorReasons: ContractorReason[],
  organizationId: string | undefined,
): Promise<void> {
  log.warn(
    { event: 'compliance.payment.would_block', contractorIds, contractorReasons, organizationId },
    'Compliance payment block (would-block, flag off)',
  );
  if (!organizationId) return;
  try {
    await db.auditLog.create({
      data: {
        organizationId,
        actorType: 'SYSTEM',
        action: 'compliance.payment.would_block',
        resourceType: 'PAYMENT_RUN',
        resourceId: contractorIds.join(','),
        metadataJson: { contractorReasons } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    log.error({ err }, 'compliance.payment.would_block audit-log write failed (non-blocking)');
  }
}

/**
 * Resolves the i18n label key for a (documentType, policyRuleId) pair.
 * Phase 71 locked-phrase registry. Plan 72-07 adds the en/de/pl translations.
 */
export function getDocumentTypeLabelKey(documentType: string, policyRuleId: string | null): string {
  if (policyRuleId) return `compliance.documentType.${policyRuleId}`;
  return `compliance.documentType.${documentType.toLowerCase()}`;
}
