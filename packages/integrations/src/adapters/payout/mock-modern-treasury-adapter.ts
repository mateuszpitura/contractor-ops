import type {
  PayoutInitiationAdapter,
  PayoutInput,
  PayoutOrder,
  PayoutOrderStatus,
  PayoutWebhookEvent,
} from './payout-initiation-adapter.js';

// Deterministic Modern Treasury payout mock — the shipped default while the
// live originator stays dark behind a flag until provider credentials land.
//
// Determinism: the payment-order id is a pure function of the caller's
// idempotency key and the amount/currency are echoed from the request. No
// network, no randomness; the same input always yields the same order. The
// object shape and the status enum mirror the documented Modern Treasury
// `payment_order` (an `ach` `credit`) so the live path can slot in behind the
// same interface without a shape change.

const ORDER_ID_PREFIX = 'pm_order_';

/** The status a freshly-initiated mock order reports (an in-flight state). */
const INITIATED_STATUS: PayoutOrderStatus = 'processing';

/** The terminal status the mock reports once an order is queried (settled). */
const SETTLED_STATUS: PayoutOrderStatus = 'reconciled';

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

export class MockModernTreasuryAdapter implements PayoutInitiationAdapter {
  async initiatePayout(input: PayoutInput): Promise<PayoutOrder> {
    return {
      id: `${ORDER_ID_PREFIX}${sanitizeKeySegment(input.idempotencyKey)}`,
      status: INITIATED_STATUS,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  async getPayoutStatus(_orderId: string): Promise<PayoutOrderStatus> {
    return SETTLED_STATUS;
  }

  async handleWebhook(payload: unknown): Promise<PayoutWebhookEvent | null> {
    if (payload === null || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    const orderId = record.orderId;
    const status = record.status;
    if (typeof orderId !== 'string' || !isPayoutOrderStatus(status)) return null;
    return { orderId, status };
  }
}

function isPayoutOrderStatus(value: unknown): value is PayoutOrderStatus {
  return (
    value === 'pending' ||
    value === 'approved' ||
    value === 'processing' ||
    value === 'sent' ||
    value === 'completed' ||
    value === 'reconciled'
  );
}
