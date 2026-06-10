// Snapshot builder for PaymentRunComplianceCheck.
//
// Captures the FULL set of BLOCKING-severity ContractorComplianceItem rows
// (frozen copy) regardless of status — a PASS verdict still snapshots the full
// BLOCKING set so auditors can see what was CHECKED, not just what FAILED. The
// resulting snapshotJson is replay-ready: a future audit can reconstruct "why
// did this export pass for contractor X on date Y" without joining live tables.

import { POLICY_RULE_SET_VERSION } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';

/** Minimal structural client — satisfied by the tx, the extended client, or the bare client. */
export interface SnapshotClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
  };
}

export interface ItemSnapshot {
  itemId: string;
  policyRuleId: string | null;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  status: 'MISSING' | 'PENDING' | 'SATISFIED' | 'EXPIRED' | 'WAIVED';
  expiresAt: string | null;
  expiryJurisdictionTz: string | null;
  satisfiedByDocumentId: string | null;
  waivedReason: string | null;
  createdAt: string;
}

export interface FailureReason {
  itemId: string;
  reason: 'severity_blocking_expired' | 'severity_blocking_missing';
  expiredOnDate?: string;
}

export interface SnapshotResult {
  snapshotJson: {
    items: ItemSnapshot[];
    policyRuleSetVersion: string;
    jurisdictionDate: string;
    eligibilityVerdict: 'PASS' | 'FAIL';
    failureReasons: FailureReason[];
  };
  policyRuleSetVersion: string;
  eligibilityVerdict: 'PASS' | 'FAIL';
  failureReasons: FailureReason[];
}

type ComplianceItemRow = {
  id: string;
  policyRuleId: string | null;
  severity: 'BLOCKING' | 'WARNING' | 'INFO' | null;
  status: 'MISSING' | 'PENDING' | 'SATISFIED' | 'EXPIRED' | 'WAIVED';
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  satisfiedByDocumentId: string | null;
  waivedReason: string | null;
  createdAt: Date;
};

export async function buildSnapshotForContractor(
  tx: SnapshotClient,
  contractorId: string,
  jurisdictionDate: string,
): Promise<SnapshotResult> {
  // Pull ALL BLOCKING-severity items regardless of status (full checked set).
  // NOTE: ContractorComplianceItem has no waivedAt/satisfiedAt columns —
  // they are intentionally omitted from the select + snapshot.
  const items = (await tx.contractorComplianceItem.findMany({
    where: { contractorId, severity: 'BLOCKING' },
    select: {
      id: true,
      policyRuleId: true,
      severity: true,
      status: true,
      expiresAt: true,
      expiryJurisdictionTz: true,
      satisfiedByDocumentId: true,
      waivedReason: true,
      createdAt: true,
    },
  })) as ComplianceItemRow[];

  const itemSnapshots: ItemSnapshot[] = items.map(it => ({
    itemId: it.id,
    policyRuleId: it.policyRuleId,
    severity: it.severity ?? 'BLOCKING',
    status: it.status,
    expiresAt: it.expiresAt ? it.expiresAt.toISOString() : null,
    expiryJurisdictionTz: it.expiryJurisdictionTz,
    satisfiedByDocumentId: it.satisfiedByDocumentId,
    waivedReason: it.waivedReason,
    createdAt: it.createdAt.toISOString(),
  }));

  const failureReasons: FailureReason[] = items
    .filter(it => it.status === 'EXPIRED' || it.status === 'MISSING')
    .map(it => ({
      itemId: it.id,
      reason: it.status === 'EXPIRED' ? 'severity_blocking_expired' : 'severity_blocking_missing',
      expiredOnDate: it.expiresAt ? it.expiresAt.toISOString().slice(0, 10) : undefined,
    }));

  const eligibilityVerdict: 'PASS' | 'FAIL' = failureReasons.length === 0 ? 'PASS' : 'FAIL';
  const policyRuleSetVersion: string = POLICY_RULE_SET_VERSION;

  return {
    snapshotJson: {
      items: itemSnapshots,
      policyRuleSetVersion,
      jurisdictionDate,
      eligibilityVerdict,
      failureReasons,
    },
    policyRuleSetVersion,
    eligibilityVerdict,
    failureReasons,
  };
}
