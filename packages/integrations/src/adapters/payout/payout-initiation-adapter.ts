// Programmatic-ACH payout-initiation seam.
//
// Mirrors the tin-match client seam (a focused interface + a deterministic mock
// default + a flag-dark live concrete), NOT BaseAdapter — payout origination is
// a different lifecycle from the OAuth/sync-shaped provider adapters.
//
// The shape follows the Modern Treasury `payment_order` object: an ACH credit
// carries an amount + currency and advances through the documented lifecycle
//   pending -> approved -> processing -> sent -> completed -> reconciled
// (reconciled = fully settled). A deterministic MockModernTreasuryAdapter is the
// shipped default; the live originator and the Stripe Treasury stub sit behind
// this same interface. Callers depend only on this interface.

/**
 * The Modern Treasury `payment_order` lifecycle. `reconciled` is terminal
 * (fully settled); the earlier members are the in-flight states a webhook
 * advances through.
 */
export type PayoutOrderStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'sent'
  | 'completed'
  | 'reconciled';

/** A single ACH credit payout request. */
export interface PayoutInput {
  /**
   * Caller-supplied idempotency key. The provider dedupes retries carrying the
   * same key; the mock derives its deterministic order id from it.
   */
  idempotencyKey: string;
  /** The settled amount in integer minor units (already FX-converted). */
  amountMinor: number;
  /** ISO 4217 currency of the settled amount. */
  currency: string;
  /** The receiver's legal name as it appears on the counterparty account. */
  receiverName: string;
  /**
   * The receiver's ABA routing number. For the mock/dark paths this is the
   * masked value — full routing/account numbers are AES-256-GCM at rest and are
   * only decrypted inside the live originator, never logged.
   */
  routingNumber: string;
  /** The receiver's account number (masked on the mock/dark paths). */
  accountNumber: string;
}

/**
 * The Modern Treasury `payment_order` returned by an initiation. An ACH credit
 * (`type: 'ach'`, `direction: 'credit'`) with the caller's amount + currency
 * echoed back and a lifecycle status.
 */
export interface PayoutOrder {
  /** The provider-assigned payment-order id. */
  id: string;
  /** The current lifecycle status. */
  status: PayoutOrderStatus;
  /** The amount in integer minor units, echoed from the request. */
  amountMinor: number;
  /** The ISO 4217 currency, echoed from the request. */
  currency: string;
}

/** The webhook lifecycle event a provider posts to advance an order's status. */
export interface PayoutWebhookEvent {
  orderId: string;
  status: PayoutOrderStatus;
}

/**
 * Abstracts programmatic-ACH payout origination. Implementations return the
 * provider `payment_order`; idempotency, audit, and gating live in the
 * consuming procedure, not here.
 */
export interface PayoutInitiationAdapter {
  /** Originate an ACH credit payout and return the created payment_order. */
  initiatePayout(input: PayoutInput): Promise<PayoutOrder>;
  /** Read the current lifecycle status of a previously created order. */
  getPayoutStatus(orderId: string): Promise<PayoutOrderStatus>;
  /**
   * Parse a provider webhook payload into a lifecycle event, or `null` when the
   * payload is not a recognised order event. Implementations MUST `safeParse`
   * the payload — never cast an untrusted webhook body.
   */
  handleWebhook?(payload: unknown): Promise<PayoutWebhookEvent | null>;
}
