import type {
  PlaidIdentityClient,
  PlaidVerificationResult,
  PlaidVerificationStatus,
  PlaidVerifyInput,
} from './plaid-identity-client.js';

// Deterministic Plaid Identity mock — the shipped default while the live client
// stays dark behind a flag.
//
// Determinism: the status is a pure function of the account id via a fixed
// fixture map (no network, no randomness; the same input always yields the same
// status). An unverified status (PENDING/FAILED) always carries an advisory
// warning; a VERIFIED status never does. The advisory-vs-block policy is the
// caller's (fail-open) — this client never throws on an unverified account.

/** Account ids the fixture treats as a confirmed name/account mismatch. */
const KNOWN_FAILED_ACCOUNT_IDS = new Set<string>(['plaid-acct-mismatch']);

/** Account ids the fixture treats as verification still in progress. */
const KNOWN_PENDING_ACCOUNT_IDS = new Set<string>(['plaid-acct-pending']);

export class MockPlaidIdentityClient implements PlaidIdentityClient {
  async verify(input: PlaidVerifyInput): Promise<PlaidVerificationResult> {
    const status = this.statusFor(input.accountId);

    if (status === 'VERIFIED') {
      return { status, plaidAccountId: input.accountId, nameMatchScore: 1 };
    }

    const advisoryWarning =
      status === 'PENDING'
        ? `Plaid Identity verification for "${input.legalName}" is still pending — payout may proceed advisory-only.`
        : `Plaid Identity could not verify "${input.legalName}" against the bank account — payout may proceed advisory-only.`;

    return {
      status,
      advisoryWarning,
      plaidAccountId: input.accountId,
      nameMatchScore: status === 'PENDING' ? 0.5 : 0,
    };
  }

  private statusFor(accountId: string): PlaidVerificationStatus {
    if (KNOWN_FAILED_ACCOUNT_IDS.has(accountId)) return 'FAILED';
    if (KNOWN_PENDING_ACCOUNT_IDS.has(accountId)) return 'PENDING';
    return 'VERIFIED';
  }
}
