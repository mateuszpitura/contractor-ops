import { mockId } from '../utils.js';

/** Factory for Stripe-like objects with realistic shapes. */
export const stripeFixtures = {
  customer: (overrides?: Record<string, unknown>) => ({
    id: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
    object: 'customer' as const,
    email: 'contractor@example.com',
    name: 'Test Contractor LLC',
    metadata: { organizationId: 'org-001' },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  }),

  subscription: (overrides?: Record<string, unknown>) => ({
    id: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
    object: 'subscription' as const,
    status: 'active' as const,
    customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: `si_${mockId().replace(/-/g, '').slice(0, 14)}`,
          price: {
            id: 'price_monthly',
            unit_amount: 4900,
            currency: 'pln',
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
    },
    ...overrides,
  }),

  invoice: (overrides?: Record<string, unknown>) => ({
    id: `in_${mockId().replace(/-/g, '').slice(0, 14)}`,
    object: 'invoice' as const,
    status: 'paid' as const,
    amount_due: 4900,
    amount_paid: 4900,
    currency: 'pln',
    customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
    subscription: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
    hosted_invoice_url: 'https://invoice.stripe.com/test',
    invoice_pdf: 'https://invoice.stripe.com/test/pdf',
    ...overrides,
  }),
};
