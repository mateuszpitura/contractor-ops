/**
 * Integration: raw fetch() calls to Stripe API intercepted by MSW mock handlers.
 *
 * NOTE: The Stripe Node SDK uses https in a way that often bypasses MSW,
 * so these tests verify Stripe endpoints via raw fetch() to ensure the
 * MSW handlers work correctly for HTTP-level interception.
 */
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const STRIPE_BASE = 'https://api.stripe.com';
const AUTH_HEADER = { Authorization: 'Bearer sk_test_mock_key' };

// ---------------------------------------------------------------------------
// MSW Server
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['stripe']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe endpoints + MSW (raw fetch)', () => {
  it('POST /v1/customers creates a customer with an id', async () => {
    const response = await fetch(`${STRIPE_BASE}/v1/customers`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'email=test@example.com&name=Test+User',
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('customer');
    expect(data.id).toMatch(/^cus_/);
    expect(data.email).toBe('contractor@example.com');
  });

  it('GET /v1/subscriptions/:id returns a subscription', async () => {
    const subId = 'sub_test123';
    const response = await fetch(`${STRIPE_BASE}/v1/subscriptions/${subId}`, {
      headers: AUTH_HEADER,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('subscription');
    expect(data.id).toBe(subId);
    expect(data.status).toBe('active');
    expect(data.items.data).toHaveLength(1);
  });

  it('POST /v1/billing_portal/sessions returns a portal URL', async () => {
    const response = await fetch(`${STRIPE_BASE}/v1/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'customer=cus_test123&return_url=https://app.example.com/billing',
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('billing_portal.session');
    expect(data.url).toBe('https://billing.stripe.com/test');
    expect(data.id).toMatch(/^bps_/);
  });

  it('POST /v1/billing/meter_events returns 200', async () => {
    const response = await fetch(`${STRIPE_BASE}/v1/billing/meter_events`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'event_name=api_request&payload[stripe_customer_id]=cus_test&payload[value]=1',
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('billing.meter_event');
    expect(data.identifier).toBeDefined();
  });

  it('GET /v1/invoices returns a list', async () => {
    const response = await fetch(`${STRIPE_BASE}/v1/invoices`, {
      headers: AUTH_HEADER,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data).toHaveProperty('has_more', false);
  });

  it('POST /v1/checkout/sessions returns a checkout URL', async () => {
    const response = await fetch(`${STRIPE_BASE}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'mode=subscription&success_url=https://app.example.com/success',
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('checkout.session');
    expect(data.url).toBe('https://checkout.stripe.com/test');
    expect(data.id).toMatch(/^cs_test_/);
  });

  it('GET /v1/customers/:id returns customer details', async () => {
    const cusId = 'cus_existing123';
    const response = await fetch(`${STRIPE_BASE}/v1/customers/${cusId}`, {
      headers: AUTH_HEADER,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.object).toBe('customer');
    expect(data.id).toBe(cusId);
  });

  it('DELETE /v1/subscriptions/:id cancels subscription', async () => {
    const subId = 'sub_cancel123';
    const response = await fetch(`${STRIPE_BASE}/v1/subscriptions/${subId}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.id).toBe(subId);
    expect(data.status).toBe('canceled');
  });
});
