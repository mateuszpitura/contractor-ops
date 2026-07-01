import { createLogger } from '@contractor-ops/logger';
import { decryptCredentials } from '../../services/credential-service.js';
import type {
  PayoutInitiationAdapter,
  PayoutInput,
  PayoutOrder,
  PayoutOrderStatus,
  PayoutWebhookEvent,
} from './payout-initiation-adapter.js';

// DARK live Modern Treasury payout originator.
//
// Built behind the PayoutInitiationAdapter seam but NOT on the default path: the
// shipped default is MockModernTreasuryAdapter. This originator is instantiated
// only once the `payments.ach-payouts` flag flips and Modern Treasury
// credentials land. While dark it refuses to originate rather than silently
// fabricating a payment_order.
//
// Live wiring (deferred to activation, gated by the Task-1 supply-chain
// checkpoint): the official `modern-treasury` SDK is imported lazily INSIDE the
// enabled branch only — never at module top level — so this package builds with
// zero external dependencies. The live call is `POST /payment_orders` with
// `{ type: 'ach', direction: 'credit', amount, currency, originating_account_id,
// receiving_account_id }` over HTTP Basic auth (Org-ID = username, API-key =
// password), decrypted from the AES-256-GCM credential blob. Full
// routing/account numbers are only decrypted here and are NEVER logged.

const log = createLogger({ service: 'modern-treasury-adapter' });

export interface LiveModernTreasuryAdapterConfig {
  /** The encrypted credential blob reference (AES-256-GCM). */
  credentialsRef?: string;
}

export class LiveModernTreasuryAdapter implements PayoutInitiationAdapter {
  private readonly credentialsRef: string | null;

  constructor(config: LiveModernTreasuryAdapterConfig = {}) {
    this.credentialsRef = config.credentialsRef ?? null;
  }

  async initiatePayout(input: PayoutInput): Promise<PayoutOrder> {
    this.refuseWhileDark('initiatePayout', input.idempotencyKey);
  }

  async getPayoutStatus(orderId: string): Promise<PayoutOrderStatus> {
    this.refuseWhileDark('getPayoutStatus', orderId);
  }

  async handleWebhook(payload: unknown): Promise<PayoutWebhookEvent | null> {
    // A live deployment verifies the Modern Treasury webhook signature and
    // safeParses the payload before acting. Dark: never trust an unsigned event.
    log.warn(
      { hasPayload: payload !== null && payload !== undefined },
      'live Modern Treasury webhook received while originator is dark — ignoring',
    );
    return null;
  }

  private refuseWhileDark(operation: string, reference: string): never {
    // Touch the credential store so the constructed-but-dark client still
    // validates its blob shape; the decrypted secret is never logged.
    let hasCredentials = false;
    if (this.credentialsRef) {
      const blob = decryptCredentials(this.credentialsRef, 'modern-treasury');
      hasCredentials = blob.accessToken.length > 0;
    }
    log.warn(
      { operation, hasCredentials },
      'live Modern Treasury originator invoked while flag-dark — refusing to originate',
    );
    throw new Error(
      `LiveModernTreasuryAdapter is dark: ${operation} requires the payments.ach-payouts flag and Modern Treasury credentials before use (idempotencyKey ${reference.slice(0, 8)}…)`,
    );
  }
}
