/**
 * Stripe live-smoke — read-only balance fetch against the test-mode key.
 *
 * Proves: the Stripe secret key resolves and the API contract responds.
 * Side effects: none (GET /v1/balance is read-only).
 *
 * Deeper smoke (optional, manual): `stripe trigger payment_intent.succeeded`
 * against a `stripe listen --forward-to <api>/webhooks/stripe` tunnel, then
 * assert the StripeEvent row + processedAt. Not automated here because it
 * needs the API running + a tunnel.
 */

import { expect, it } from 'vitest';
import { smokeDescribe, smokeFetch } from './harness.js';

smokeDescribe('stripe', ['STRIPE_SECRET_KEY'], () => {
  it('authenticates and reads account balance (test mode)', async () => {
    const key = process.env.STRIPE_SECRET_KEY as string;
    expect(key.startsWith('sk_test_') || key.startsWith('rk_test_')).toBe(true);

    const res = await smokeFetch('https://api.stripe.com/v1/balance', {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object?: string };
    expect(body.object).toBe('balance');
  });
});
