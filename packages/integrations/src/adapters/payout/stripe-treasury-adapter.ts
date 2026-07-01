import { createLogger } from '@contractor-ops/logger';
import type {
  PayoutInitiationAdapter,
  PayoutInput,
  PayoutOrder,
  PayoutOrderStatus,
} from './payout-initiation-adapter.js';

// Stripe Treasury payout stub.
//
// A second concrete on the PayoutInitiationAdapter seam, kept as a stub: Modern
// Treasury is the v7.0 first concrete, Stripe Treasury is a placeholder that
// proves the interface is provider-agnostic. It refuses every operation until a
// live Stripe Treasury path is genuinely built and gated — never fabricates a
// payment_order.

const log = createLogger({ service: 'stripe-treasury-adapter' });

export class StripeTreasuryAdapter implements PayoutInitiationAdapter {
  async initiatePayout(input: PayoutInput): Promise<PayoutOrder> {
    return this.refuse('initiatePayout', input.idempotencyKey);
  }

  async getPayoutStatus(orderId: string): Promise<PayoutOrderStatus> {
    return this.refuse('getPayoutStatus', orderId);
  }

  private refuse(operation: string, reference: string): never {
    log.warn({ operation }, 'Stripe Treasury payout stub invoked — not implemented');
    throw new Error(
      `StripeTreasuryAdapter is a stub: ${operation} is not implemented (reference ${reference.slice(0, 8)}…)`,
    );
  }
}
