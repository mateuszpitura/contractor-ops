import type Stripe from "stripe";

/**
 * Creates a mock Stripe event for testing webhook handlers.
 */
export function createMockStripeEvent(
  type: string,
  data: Record<string, unknown>,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2025-06-30.basil",
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: data as Stripe.Event.Data["object"],
      previous_attributes: undefined,
    },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  } as Stripe.Event;
}

/**
 * Creates a mock Stripe subscription object with sensible defaults.
 */
export function createMockSubscription(
  overrides?: Partial<Record<string, unknown>>,
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `sub_test_${Date.now()}`,
    object: "subscription",
    status: "active",
    customer: "cus_test_123",
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    trial_end: null,
    cancel_at_period_end: false,
    metadata: { organizationId: "org_test" },
    items: {
      object: "list",
      data: [
        {
          id: "si_test_123",
          price: {
            id: "price_test_starter",
          },
          quantity: 1,
        },
      ],
      has_more: false,
      url: "",
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

/**
 * Creates a mock Stripe invoice object with sensible defaults.
 */
export function createMockInvoice(
  overrides?: Partial<Record<string, unknown>>,
): Stripe.Invoice {
  return {
    id: `in_test_${Date.now()}`,
    object: "invoice",
    status: "paid",
    subscription: "sub_test_123",
    customer: "cus_test_123",
    billing_reason: "subscription_cycle",
    total: 35000,
    currency: "pln",
    ...overrides,
  } as unknown as Stripe.Invoice;
}
