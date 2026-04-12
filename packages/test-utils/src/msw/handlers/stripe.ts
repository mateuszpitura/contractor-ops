import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function stripeHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- Customers ---
    http.post('https://api.stripe.com/v1/customers', async ({ request: _request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'customer',
        email: 'contractor@example.com',
        name: 'Test Contractor',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      });
    }),

    http.get('https://api.stripe.com/v1/customers/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'customer',
        email: 'contractor@example.com',
        name: 'Test Contractor',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        subscriptions: { data: [], has_more: false },
      });
    }),

    // --- Subscriptions ---
    http.post('https://api.stripe.com/v1/subscriptions', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `sub_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'subscription',
        status: 'active',
        customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        start_date: Math.floor(Date.now() / 1000),
        trial_end: null,
        metadata: {},
        items: {
          data: [
            {
              id: `si_${mockId().replace(/-/g, '').slice(0, 14)}`,
              price: { id: 'price_test', unit_amount: 4900, currency: 'pln', product: 'prod_test' },
              quantity: 1,
            },
          ],
        },
        latest_invoice: `in_${mockId().replace(/-/g, '').slice(0, 14)}`,
      });
    }),

    http.get('https://api.stripe.com/v1/subscriptions/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'subscription',
        status: 'active',
        customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        cancel_at_period_end: false,
        metadata: {},
        trial_end: null,
        start_date: Math.floor(Date.now() / 1000) - 90 * 24 * 3600,
        items: {
          data: [
            {
              id: `si_${mockId().replace(/-/g, '').slice(0, 14)}`,
              price: { id: 'price_test', unit_amount: 4900, currency: 'pln', product: 'prod_test' },
              quantity: 1,
            },
          ],
        },
      });
    }),

    // Stripe SDK uses POST for update (not PATCH)
    http.post('https://api.stripe.com/v1/subscriptions/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'subscription',
        status: 'active',
        customer: `cus_${mockId().replace(/-/g, '').slice(0, 14)}`,
        items: {
          data: [
            {
              id: `si_${mockId().replace(/-/g, '').slice(0, 14)}`,
              price: { id: 'price_test', unit_amount: 4900, currency: 'pln' },
              quantity: 1,
            },
          ],
        },
        metadata: {},
      });
    }),

    http.delete('https://api.stripe.com/v1/subscriptions/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'subscription',
        status: 'canceled',
      });
    }),

    // --- Invoices ---
    http.get('https://api.stripe.com/v1/invoices/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'invoice',
        status: 'paid',
        amount_due: 4900,
        amount_paid: 4900,
        currency: 'pln',
        hosted_invoice_url: 'https://invoice.stripe.com/test',
        invoice_pdf: 'https://invoice.stripe.com/test/pdf',
      });
    }),

    http.get('https://api.stripe.com/v1/invoices', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({ data: [], has_more: false });
    }),

    // --- Checkout Sessions ---
    http.post('https://api.stripe.com/v1/checkout/sessions', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `cs_test_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/test',
        status: 'open',
      });
    }),

    // --- Billing Portal ---
    http.post('https://api.stripe.com/v1/billing_portal/sessions', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `bps_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'billing_portal.session',
        url: 'https://billing.stripe.com/test',
      });
    }),

    // --- Prices ---
    http.get('https://api.stripe.com/v1/prices', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        data: [
          {
            id: 'price_test_monthly',
            object: 'price',
            unit_amount: 4900,
            currency: 'pln',
            recurring: { interval: 'month' },
            product: 'prod_test',
          },
        ],
        has_more: false,
      });
    }),

    // --- Invoice Preview (proration) ---
    http.post('https://api.stripe.com/v1/invoices/create_preview', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        object: 'invoice',
        status: 'draft',
        amount_due: 2450,
        currency: 'pln',
        lines: {
          data: [
            {
              id: `il_${mockId().replace(/-/g, '').slice(0, 14)}`,
              amount: 2450,
              description: 'Proration',
              proration: true,
              period: {
                start: Math.floor(Date.now() / 1000),
                end: Math.floor(Date.now() / 1000) + 15 * 24 * 3600,
              },
            },
          ],
        },
      });
    }),

    // --- Subscription Items ---
    http.post('https://api.stripe.com/v1/subscription_items', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: `si_${mockId().replace(/-/g, '').slice(0, 14)}`,
        object: 'subscription_item',
        price: { id: 'price_test', unit_amount: 4900, currency: 'pln' },
        quantity: 1,
      });
    }),

    // Stripe SDK uses POST for update (not PATCH)
    http.post('https://api.stripe.com/v1/subscription_items/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'subscription_item',
        quantity: 1,
      });
    }),

    http.delete('https://api.stripe.com/v1/subscription_items/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'subscription_item',
        deleted: true,
      });
    }),

    // --- Billing Meter Events ---
    http.post('https://api.stripe.com/v1/billing/meter_events', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        object: 'billing.meter_event',
        identifier: mockId(),
      });
    }),

    // --- Products ---
    http.get('https://api.stripe.com/v1/products/:id', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        id: params.id,
        object: 'product',
        name: 'Contractor Ops Pro',
        active: true,
      });
    }),
  ];
}
