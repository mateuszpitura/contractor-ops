// Terminal-RED Wave-0 scaffold for the Plaid Identity verification seam.
//
// RED until `../adapters/plaid-adapter.js` exists, exporting a deterministic
// `MockPlaidIdentityClient` (the shipped default) behind a `PlaidIdentityClient`
// interface. The import resolves to a not-yet-existing module, so the suite
// fails at module resolution (Cannot find module) — the right reason, not a typo
// or an assertion bug.
//
// This pins the advisory, fail-open contract a downstream wave must satisfy,
// mirroring the USPS address-verification posture:
//   - `verify` returns a status of VERIFIED / PENDING / FAILED
//   - an unverified status surfaces an advisory warning, never a thrown
//     PRECONDITION_FAILED (fail-open — an unverified account warns, never blocks
//     the payout)

import { describe, expect, it } from 'vitest';
import type { PlaidIdentityClient, PlaidVerificationStatus } from '../adapters/plaid-adapter.js';
import { MockPlaidIdentityClient } from '../adapters/plaid-adapter.js';

const STATUSES: PlaidVerificationStatus[] = ['VERIFIED', 'PENDING', 'FAILED'];

const verifiedAccount = {
  accountId: 'plaid-acct-verified',
  legalName: 'Jan Kowalski',
  routingNumber: '021000021',
  accountNumber: '000123456789',
} as const;

const unverifiedAccount = {
  accountId: 'plaid-acct-mismatch',
  legalName: 'Someone Else',
  routingNumber: '021000021',
  accountNumber: '000999888777',
} as const;

describe('MockPlaidIdentityClient', () => {
  const client: PlaidIdentityClient = new MockPlaidIdentityClient();

  it('returns a verification status drawn from VERIFIED / PENDING / FAILED', async () => {
    const result = await client.verify(verifiedAccount);
    expect(STATUSES).toContain(result.status);
  });

  it('is deterministic — the same account yields the same status', async () => {
    const first = await client.verify(verifiedAccount);
    const second = await client.verify(verifiedAccount);
    expect(second.status).toBe(first.status);
  });

  it('marks a name/account mismatch as not VERIFIED', async () => {
    const result = await client.verify(unverifiedAccount);
    expect(result.status).not.toBe('VERIFIED');
  });

  it('surfaces an advisory warning for an unverified account and never throws', async () => {
    const result = await client.verify(unverifiedAccount);
    expect(result.status).not.toBe('VERIFIED');
    expect(result.advisoryWarning).toBeTruthy();
  });

  it('carries no advisory warning when the account verifies', async () => {
    const result = await client.verify(verifiedAccount);
    if (result.status === 'VERIFIED') {
      expect(result.advisoryWarning).toBeFalsy();
    }
  });
});
