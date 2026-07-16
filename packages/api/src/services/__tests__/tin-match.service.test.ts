// tin-match.service unit suite.
//
// Exercises the TIN-Match logic that ships fully against a deterministic
// TinMatchClient mock while the live IRS e-Services client stays dark:
//   - a mismatch (non-zero IRS numerical response indicator) sets the recipient
//     backup-withholding flag AND raises an admin escalation, and NEVER
//     hard-blocks — the 1099 still generates with the TIN as captured;
//   - a 24h cache hit avoids re-calling the client;
//   - a transient client failure is retried before surfacing.
//
// No live database is touched: the side-effect ports (backup-withholding flag,
// escalation, audit) are injected, so the deterministic core is fully tested
// against mocks and the generated types only.

import { MockTinMatchClient } from '@contractor-ops/integrations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditWriterClient } from '../audit-writer';
import type {
  TinMatchPersistence,
  YearEndTinRevalidationDb,
  YearEndTinRevalidationTx,
} from '../tin-match.service';
import {
  clearTinMatchCache,
  createBackupWithholdingFlagWriter,
  createDbTinMatchPersistence,
  createTinMismatchEscalationWriter,
  matchRecipientTin,
  revalidateBatchTins,
  revalidateYearEndTins,
} from '../tin-match.service';

beforeEach(() => {
  clearTinMatchCache();
});

// Deterministic mock standing in for the IRS e-Services TinMatchClient. The
// numerical response indicator (0 = match, non-zero = mismatch) is the contract
// shared by both interactive and bulk live modes.
function mockClient(indicator: number) {
  return { match: vi.fn(async () => ({ responseIndicator: indicator, matched: indicator === 0 })) };
}

function mockPersistence(): TinMatchPersistence {
  return {
    setBackupWithholdingFlag: vi.fn(async () => undefined),
    createEscalation: vi.fn(async () => undefined),
    writeAudit: vi.fn(async () => undefined),
  };
}

describe('tin-match.service — mismatch handling', () => {
  it('on a mismatch sets the backup-withholding flag + creates an escalation and never hard-blocks', async () => {
    const client = mockClient(1);

    const result = await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      name: 'Jane Q. Contractor',
      tin: '078051120',
      client,
    });

    expect(result.matched).toBe(false);
    expect(result.backupWithholdingFlagSet).toBe(true);
    expect(result.escalationCreated).toBe(true);
    expect(result.hardBlocked).toBe(false);
  });

  it('persists the flag + escalation + audit through the injected ports on a mismatch', async () => {
    const client = mockClient(3);
    const persistence = mockPersistence();

    await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-mismatch',
      name: 'Jane Q. Contractor',
      tin: '078051120',
      client,
      persistence,
    });

    expect(persistence.setBackupWithholdingFlag).toHaveBeenCalledTimes(1);
    expect(persistence.createEscalation).toHaveBeenCalledTimes(1);
    expect(persistence.writeAudit).toHaveBeenCalledTimes(1);
    // The full TIN never reaches a port — last-4 only.
    expect(persistence.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ tinLast4: '1120' }),
    );
  });

  it('on a match sets no flag, raises no escalation, and never blocks', async () => {
    const client = mockClient(0);
    const persistence = mockPersistence();

    const result = await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-ok',
      name: 'Match Co',
      tin: '12-3456789',
      tinType: 'EIN',
      client,
      persistence,
    });

    expect(result.matched).toBe(true);
    expect(result.backupWithholdingFlagSet).toBe(false);
    expect(result.escalationCreated).toBe(false);
    expect(result.hardBlocked).toBe(false);
    expect(persistence.setBackupWithholdingFlag).not.toHaveBeenCalled();
    expect(persistence.createEscalation).not.toHaveBeenCalled();
  });
});

describe('tin-match.service — cache + retry', () => {
  it('a 24h cache hit avoids re-calling the client', async () => {
    const client = mockClient(0);

    await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      name: 'Jane',
      tin: '078051120',
      client,
    });
    await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      name: 'Jane',
      tin: '078051120',
      client,
    });

    expect(client.match).toHaveBeenCalledTimes(1);
  });

  it('retries on a transient client failure before surfacing a result', async () => {
    const match = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ responseIndicator: 0, matched: true });

    const result = await matchRecipientTin({
      organizationId: 'org-1',
      recipientId: 'rcpt-2',
      name: 'Jane',
      tin: '078051120',
      client: { match },
    });

    expect(match).toHaveBeenCalledTimes(2);
    expect(result.matched).toBe(true);
  });
});

describe('tin-match.service — backup-withholding flag column writer', () => {
  function mockFlagDb() {
    return { contractor: { updateMany: vi.fn(async () => ({ count: 1 })) } };
  }

  it('persists Contractor.backupWithholdingFlagged=true, tenant-scoped and idempotent', async () => {
    const db = mockFlagDb();
    const writer = createBackupWithholdingFlagWriter(db);

    await writer({ organizationId: 'org-1', recipientId: 'rcpt-1', tinLast4: '1120' });
    expect(db.contractor.updateMany).toHaveBeenCalledWith({
      where: { id: 'rcpt-1', organizationId: 'org-1' },
      data: { backupWithholdingFlagged: true },
    });

    // A re-run is the same idempotent set — the flag is never toggled off.
    await writer({ organizationId: 'org-1', recipientId: 'rcpt-1', tinLast4: '1120' });
    expect(db.contractor.updateMany).toHaveBeenCalledTimes(2);
  });

  it('never lets a full TIN reach the column write (only the boolean is persisted)', async () => {
    const db = mockFlagDb();
    const writer = createBackupWithholdingFlagWriter(db);

    await writer({ organizationId: 'org-1', recipientId: 'rcpt-1', tinLast4: '1120' });

    const call = db.contractor.updateMany.mock.calls[0]?.[0];
    expect(JSON.stringify(call)).not.toContain('078051120');
    expect(call?.data).toEqual({ backupWithholdingFlagged: true });
  });

  it('the DB-backed persistence wires the column writer for the mismatch path', async () => {
    const db = mockFlagDb();
    const persistence = createDbTinMatchPersistence({
      setBackupWithholdingFlag: createBackupWithholdingFlagWriter(db),
      createEscalation: vi.fn(async () => undefined),
    });

    await persistence.setBackupWithholdingFlag({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      tinLast4: '1120',
    });

    expect(db.contractor.updateMany).toHaveBeenCalledWith({
      where: { id: 'rcpt-1', organizationId: 'org-1' },
      data: { backupWithholdingFlagged: true },
    });
  });
});

describe('tin-match.service — year-end batch revalidate', () => {
  it('completes every recipient even when one mismatches (never aborts the loop)', async () => {
    // 0 = match, 3 = name/TIN mismatch — distinct response per call.
    const match = vi
      .fn()
      .mockResolvedValueOnce({ responseIndicator: 0, matched: true })
      .mockResolvedValueOnce({ responseIndicator: 3, matched: false })
      .mockResolvedValueOnce({ responseIndicator: 0, matched: true });
    const persistence = mockPersistence();

    const results = await revalidateBatchTins({
      organizationId: 'org-1',
      recipients: [
        { recipientId: 'a', name: 'A', tin: '111111111' },
        { recipientId: 'b', name: 'B', tin: '222222222' },
        { recipientId: 'c', name: 'C', tin: '333333333' },
      ],
      client: { match },
      persistence,
    });

    expect(results).toHaveLength(3);
    expect(results.map(r => r.matched)).toEqual([true, false, true]);
    expect(results.every(r => r.hardBlocked === false)).toBe(true);
    expect(persistence.createEscalation).toHaveBeenCalledTimes(1);
  });
});

describe('tin-match.service — mismatch escalation writer', () => {
  it('writes the escalation audit row on the tx (last-4 only, USER actor when supplied)', async () => {
    const create = vi.fn(async () => ({}));
    const createMany = vi.fn(async () => ({ count: 0 }));
    const tx: AuditWriterClient = { auditLog: { create, createMany } };

    const escalate = createTinMismatchEscalationWriter(tx, 'user-9');
    await escalate({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      responseIndicator: 3,
      tinLast4: '1120',
    });

    expect(create).toHaveBeenCalledTimes(1);
    const json = JSON.stringify(create.mock.calls[0]?.[0]);
    expect(json).toContain('form1099.tin_mismatch.escalated');
    expect(json).toContain('1120');
    expect(json).toContain('user-9');
    // A full TIN never reaches the escalation metadata.
    expect(json).not.toContain('078051120');
  });

  it('records a SYSTEM actor when no actor id is supplied', async () => {
    const create = vi.fn(async () => ({}));
    const createMany = vi.fn(async () => ({ count: 0 }));
    const tx: AuditWriterClient = { auditLog: { create, createMany } };

    const escalate = createTinMismatchEscalationWriter(tx, null);
    await escalate({
      organizationId: 'org-1',
      recipientId: 'rcpt-1',
      responseIndicator: 1,
      tinLast4: '9999',
    });

    expect(JSON.stringify(create.mock.calls[0]?.[0])).toContain('SYSTEM');
  });
});

describe('tin-match.service — year-end revalidation trigger (real MockTinMatchClient seam)', () => {
  function mockTxDb() {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const auditCreate = vi.fn(async () => ({}));
    const auditCreateMany = vi.fn(async () => ({ count: 0 }));
    const tx: YearEndTinRevalidationTx = {
      contractor: { updateMany },
      auditLog: { create: auditCreate, createMany: auditCreateMany },
    };
    let txOpened = 0;
    const db: YearEndTinRevalidationDb = {
      $transaction: async <T>(fn: (t: YearEndTinRevalidationTx) => Promise<T>): Promise<T> => {
        txOpened += 1;
        return fn(tx);
      },
    };
    return { updateMany, auditCreate, txCount: () => txOpened, db };
  }

  it('sets the flag for the mismatched recipient only, escalates + audits in-tx, and never blocks', async () => {
    const { updateMany, auditCreate, db } = mockTxDb();

    const result = await revalidateYearEndTins(
      {
        organizationId: 'org-1',
        actorId: 'user-1',
        recipients: [
          { recipientId: 'ok-ein', name: 'Match Co', tin: '12-3456789', tinType: 'EIN' },
          { recipientId: 'bad-ssn', name: 'Jane Q', tin: '078051120', tinType: 'SSN' },
        ],
      },
      { db, client: new MockTinMatchClient() },
    );

    expect(result.mismatchRecipientIds).toEqual(new Set(['bad-ssn']));
    // Exactly the mismatched recipient's flag is written, tenant-scoped.
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'bad-ssn', organizationId: 'org-1' },
      data: { backupWithholdingFlagged: true },
    });

    // Both the escalation and the mismatch audit rows commit in the same tx.
    const auditJson = JSON.stringify(auditCreate.mock.calls);
    expect(auditJson).toContain('form1099.tin_mismatch.escalated');
    expect(auditJson).toContain('tin_match.mismatch');
    // Advisory only: the full TIN never reaches the audit metadata (last-4 only).
    expect(auditJson).not.toContain('078051120');
    expect(auditJson).toContain('1120');
  });

  it('writes no flag and opens no escalation when every recipient matches', async () => {
    const { updateMany, auditCreate, db } = mockTxDb();

    const result = await revalidateYearEndTins(
      {
        organizationId: 'org-1',
        recipients: [
          { recipientId: 'a', name: 'A Co', tin: '12-3456789', tinType: 'EIN' },
          { recipientId: 'b', name: 'B Co', tin: '13-1234567', tinType: 'EIN' },
        ],
      },
      { db, client: new MockTinMatchClient() },
    );

    expect(result.mismatchRecipientIds.size).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('is a no-op (opens no transaction) when there are no recipients', async () => {
    const { db, txCount } = mockTxDb();

    const result = await revalidateYearEndTins(
      { organizationId: 'org-1', recipients: [] },
      { db, client: new MockTinMatchClient() },
    );

    expect(result.mismatchRecipientIds.size).toBe(0);
    expect(txCount()).toBe(0);
  });
});
