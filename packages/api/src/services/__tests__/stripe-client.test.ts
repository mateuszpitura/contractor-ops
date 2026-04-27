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

import { stripe } from '../stripe-client.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe-client', () => {
  it('exports a Stripe instance', () => {
    expect(stripe).toBeDefined();
    expect(constructorSpy).toHaveBeenCalledOnce();
  });

  it('initializes Stripe with the correct API key from env', () => {
    expect(constructorSpy).toHaveBeenCalledWith(
      'sk_test_mock_key_12345',
      expect.objectContaining({
        apiVersion: '2026-04-22.dahlia',
        typescript: true,
      }),
    );
  });

  it('uses the 2026-04-22.dahlia API version', () => {
    const callArgs = constructorSpy.mock.calls[0];
    expect(callArgs[1].apiVersion).toBe('2026-04-22.dahlia');
  });
});
