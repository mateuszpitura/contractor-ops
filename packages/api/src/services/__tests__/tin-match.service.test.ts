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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TinMatchPersistence } from '../tin-match.service';
import { clearTinMatchCache, matchRecipientTin, revalidateBatchTins } from '../tin-match.service';

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
