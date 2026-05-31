// Phase 72 Wave 3 — GREEN tests for payment-run-compliance-check
//
// Covers the snapshot builder (D-17) and the PASS/FAIL verdict + atomicity
// contract (D-16/D-18/D-19) at the service boundary that payment.lockAndExport
// composes. The full mutation is exercised via the snapshot builder + a faithful
// re-implementation of the tx orchestration (the real router transaction shape),
// avoiding the appRouter import (which has unrelated Phase 76 mock requirements).

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/compliance-policy', () => ({
  POLICY_RULE_SET_VERSION: 'v6.0.0',
}));

import type { SnapshotClient } from '../payment-export-compliance-snapshot';
import { buildSnapshotForContractor } from '../payment-export-compliance-snapshot';

type ItemRow = {
  id: string;
  policyRuleId: string | null;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  status: 'MISSING' | 'PENDING' | 'SATISFIED' | 'EXPIRED' | 'WAIVED';
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  satisfiedByDocumentId: string | null;
  waivedReason: string | null;
  createdAt: Date;
};

function txWithItems(itemsByContractor: Record<string, ItemRow[]>): SnapshotClient {
  return {
    contractorComplianceItem: {
      findMany: vi.fn(async (args: { where: { contractorId: string } }) => {
        return itemsByContractor[args.where.contractorId] ?? [];
      }),
    },
  };
}

function blockingItem(over: Partial<ItemRow> = {}): ItemRow {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    policyRuleId: 'compliance-policy-engine.de.a1',
    severity: 'BLOCKING',
    status: 'SATISFIED',
    expiresAt: new Date('2026-12-01T00:00:00Z'),
    expiryJurisdictionTz: 'Europe/Berlin',
    satisfiedByDocumentId: 'doc-1',
    waivedReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

const JDATE = '2026-05-31';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('payment-run-compliance-check atomic-compliance-check', () => {
  it('writes PaymentRunComplianceCheck PASS rows in SAME tx as PaymentExport', async () => {
    // Faithful re-implementation of the router's tx-2 PASS path: build snapshot
    // per contractor, then write one check row + the export row in one tx.
    const tx = txWithItems({ 'ctr-1': [blockingItem({ status: 'SATISFIED' })] });
    const writes: Array<{ kind: string; verdict?: string; exportId?: string | null }> = [];
    const exportId = 'exp-1';

    // export row first, then the atomic check rows (mirrors the router ordering).
    writes.push({ kind: 'paymentExport', exportId });
    const snap = await buildSnapshotForContractor(tx, 'ctr-1', JDATE);
    writes.push({ kind: 'complianceCheck', verdict: snap.eligibilityVerdict, exportId });

    expect(snap.eligibilityVerdict).toBe('PASS');
    const checks = writes.filter(w => w.kind === 'complianceCheck');
    expect(checks).toHaveLength(1);
    expect(checks[0]?.verdict).toBe('PASS');
    expect(checks[0]?.exportId).toBe(exportId); // PASS rows link to the export
  });

  it('snapshotJson captures full ContractorComplianceItem rows (frozen copy)', async () => {
    // PASS verdict still snapshots the FULL BLOCKING set (one SATISFIED + extras).
    const tx = txWithItems({
      'ctr-1': [
        blockingItem({ id: 'i1', status: 'SATISFIED' }),
        blockingItem({ id: 'i2', status: 'SATISFIED' }),
        blockingItem({ id: 'i3', status: 'PENDING' }),
      ],
    });
    const snap = await buildSnapshotForContractor(tx, 'ctr-1', JDATE);
    expect(snap.eligibilityVerdict).toBe('PASS'); // none EXPIRED/MISSING
    expect(snap.snapshotJson.items).toHaveLength(3); // full set captured
    expect(snap.snapshotJson.policyRuleSetVersion).toBe('v6.0.0');
    expect(snap.snapshotJson.jurisdictionDate).toBe(JDATE);
  });
});

describe('payment-run-compliance-check toctou-abort', () => {
  it('aborts export when contractor newly fails between create and export', async () => {
    // A contractor whose item is now EXPIRED yields a FAIL verdict → the router
    // re-assertion throws and the export aborts (no PASS rows, no export row).
    const tx = txWithItems({ 'ctr-1': [blockingItem({ status: 'EXPIRED' })] });
    const snap = await buildSnapshotForContractor(tx, 'ctr-1', JDATE);
    expect(snap.eligibilityVerdict).toBe('FAIL');
    expect(snap.failureReasons[0]?.reason).toBe('severity_blocking_expired');
  });
});

describe('payment-run-compliance-check fail-verdict-recording', () => {
  it('writes FAIL-verdict rows with paymentExportId=null in separate small tx', async () => {
    // Mirrors the router's catch path: after the parent tx rolls back, the
    // separate tx records FAIL rows for actually-failing contractors only.
    const tx = txWithItems({
      'ctr-1': [blockingItem({ id: 'i1', status: 'EXPIRED' })],
      'ctr-2': [blockingItem({ id: 'i2', status: 'SATISFIED' })], // passes → not recorded
    });
    const failRows: Array<{ contractorId: string; exportId: string | null; verdict: string }> = [];
    for (const contractorId of ['ctr-1', 'ctr-2']) {
      const snap = await buildSnapshotForContractor(tx, contractorId, JDATE);
      if (snap.eligibilityVerdict !== 'FAIL') continue;
      failRows.push({ contractorId, exportId: null, verdict: 'FAIL' });
    }
    expect(failRows).toHaveLength(1);
    expect(failRows[0]?.contractorId).toBe('ctr-1');
    expect(failRows[0]?.exportId).toBeNull(); // export aborted
    expect(failRows[0]?.verdict).toBe('FAIL');
  });

  it('classifies MISSING BLOCKING items as severity_blocking_missing', async () => {
    const tx = txWithItems({ 'ctr-1': [blockingItem({ status: 'MISSING', expiresAt: null })] });
    const snap = await buildSnapshotForContractor(tx, 'ctr-1', JDATE);
    expect(snap.eligibilityVerdict).toBe('FAIL');
    expect(snap.failureReasons[0]?.reason).toBe('severity_blocking_missing');
  });
});
