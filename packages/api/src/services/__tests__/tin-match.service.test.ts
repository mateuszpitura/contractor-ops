// tin-match.service — Wave-0 RED scaffold (US-FORM-03).
//
// Exercises the TIN-Match logic that ships fully against a deterministic
// TinMatchClient mock while the live IRS e-Services client stays dark behind a
// flag (D-11):
//   - a mismatch (non-zero IRS numerical response indicator) sets the
//     recipient backup-withholding flag AND creates an admin escalation, and
//     NEVER hard-blocks — the caller still proceeds (D-12);
//   - a 24h cache hit avoids re-calling the client (D-10);
//   - a transient client failure is retried before surfacing.
//
// The service does not exist yet, so this suite fails at module resolution —
// terminal-RED is accepted for Wave 0 (matching the P82/P84 posture).

import { describe, expect, it, vi } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { matchRecipientTin } from '../tin-match.service';

// Deterministic mock standing in for the IRS e-Services TinMatchClient. The
// numerical response indicator (0 = match, non-zero = mismatch) is the contract
// shared by both interactive (<=25) and bulk (<=100k) live modes.
function mockClient(indicator: number) {
  return { match: vi.fn(async () => ({ responseIndicator: indicator })) };
}

describe('tin-match.service — mismatch handling (US-FORM-03 / D-12)', () => {
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
});

describe('tin-match.service — cache + retry (US-FORM-03 / D-10)', () => {
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
      .mockResolvedValueOnce({ responseIndicator: 0 });

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
