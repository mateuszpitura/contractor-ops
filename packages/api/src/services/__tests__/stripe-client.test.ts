import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const { constructorSpy } = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn().mockReturnValue({
    STRIPE_SECRET_KEY: 'sk_test_mock_key_12345',
  }),
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    constructor(...args: unknown[]) {
      constructorSpy(...args);
    }
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { stripe } from '../stripe-client';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe-client', () => {
  it('exports a Stripe proxy without eagerly constructing the client', () => {
    // Merely importing/holding the proxy must not run getServerEnv() or
    // construct Stripe — that is what keeps one missing env var from bricking
    // every import chain that transitively touches this module.
    expect(stripe).toBeDefined();
    expect(constructorSpy).not.toHaveBeenCalled();
  });

  it('constructs Stripe lazily on first property access, once', () => {
    // First access through the proxy triggers construction.
    void stripe.customers;
    expect(constructorSpy).toHaveBeenCalledOnce();

    // Subsequent accesses reuse the memoized client.
    void stripe.subscriptions;
    expect(constructorSpy).toHaveBeenCalledOnce();
  });

  it('initializes Stripe with the correct API key and version from env', () => {
    void stripe.customers;
    expect(constructorSpy).toHaveBeenCalledWith(
      'sk_test_mock_key_12345',
      expect.objectContaining({
        apiVersion: '2026-04-22.dahlia',
        typescript: true,
      }),
    );
  });
});
