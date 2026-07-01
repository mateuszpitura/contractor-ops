import { createLogger } from '@contractor-ops/logger';
import { decryptCredentials } from '../../services/credential-service.js';
import type {
  PlaidIdentityClient,
  PlaidVerificationResult,
  PlaidVerifyInput,
} from './plaid-identity-client.js';

// DARK live Plaid Identity verification client.
//
// Built behind the PlaidIdentityClient seam but NOT on the default path: the
// shipped default is MockPlaidIdentityClient. This client is instantiated only
// once the `payments.plaid-verification` flag flips and Plaid credentials land.
// While dark it refuses to verify rather than fabricating a status.
//
// Live wiring (deferred to activation, gated by the Task-1 supply-chain
// checkpoint): the official `plaid` SDK is imported lazily INSIDE the enabled
// branch only — never at module top level — so this package builds with zero
// external dependencies. The live flow is Link-token → public_token exchange →
// `/auth/get` (routing/account) + `/identity/match` (name-match score),
// decrypted from the AES-256-GCM credential blob. Full routing/account numbers
// are only handled here and are NEVER logged.

const log = createLogger({ service: 'plaid-identity-client-live' });

export interface LivePlaidIdentityClientConfig {
  /** The encrypted credential blob reference (AES-256-GCM). */
  credentialsRef?: string;
}

export class LivePlaidIdentityClient implements PlaidIdentityClient {
  private readonly credentialsRef: string | null;

  constructor(config: LivePlaidIdentityClientConfig = {}) {
    this.credentialsRef = config.credentialsRef ?? null;
  }

  async verify(input: PlaidVerifyInput): Promise<PlaidVerificationResult> {
    let hasCredentials = false;
    if (this.credentialsRef) {
      const blob = decryptCredentials(this.credentialsRef, 'plaid');
      hasCredentials = blob.accessToken.length > 0;
    }
    log.warn(
      { hasCredentials, accountId: input.accountId },
      'live Plaid Identity client invoked while flag-dark — refusing to verify',
    );
    throw new Error(
      'LivePlaidIdentityClient is dark: live Plaid Identity verification requires the payments.plaid-verification flag and Plaid credentials before use',
    );
  }
}
