import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — getServerEnv is called at module level so must be mocked before import
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: () => ({
    STRIPE_PRICE_STARTER: 'price_starter_test',
    STRIPE_PRICE_PRO: 'price_pro_test',
    STRIPE_PRICE_ENTERPRISE: 'price_enterprise_test',
    STRIPE_PRICE_TOPUP_10: 'price_topup_10_test',
    STRIPE_PRICE_TOPUP_25: 'price_topup_25_test',
    STRIPE_PRICE_TOPUP_50: 'price_topup_50_test',
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  PRICE_TO_TIER_MAP,
  resolveTierFromPriceId,
  resolveTopUpCredits,
  TIER_CREDIT_ALLOWANCE,
  TRIAL_CREDIT_ALLOWANCE,
} from '../billing-constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('TIER_CREDIT_ALLOWANCE', () => {
  it('has correct values for each tier', () => {
    expect(TIER_CREDIT_ALLOWANCE.STARTER).toBe(20);
    expect(TIER_CREDIT_ALLOWANCE.PRO).toBe(100);
    expect(TIER_CREDIT_ALLOWANCE.ENTERPRISE).toBe(500);
  });
});

describe('TRIAL_CREDIT_ALLOWANCE', () => {
  it('equals 5', () => {
    expect(TRIAL_CREDIT_ALLOWANCE).toBe(5);
  });
});

describe('PRICE_TO_TIER_MAP', () => {
  it('maps test price IDs to correct tiers', () => {
    expect(PRICE_TO_TIER_MAP.price_starter_test).toBe('STARTER');
    expect(PRICE_TO_TIER_MAP.price_pro_test).toBe('PRO');
    expect(PRICE_TO_TIER_MAP.price_enterprise_test).toBe('ENTERPRISE');
  });
});

// ---------------------------------------------------------------------------
// resolveTierFromPriceId
// ---------------------------------------------------------------------------

describe('resolveTierFromPriceId', () => {
  it('returns correct tier for known price', () => {
    expect(resolveTierFromPriceId('price_starter_test')).toBe('STARTER');
    expect(resolveTierFromPriceId('price_pro_test')).toBe('PRO');
    expect(resolveTierFromPriceId('price_enterprise_test')).toBe('ENTERPRISE');
  });

  it('throws for unknown price ID', () => {
    expect(() => resolveTierFromPriceId('price_unknown')).toThrow(
      '[billing] Unknown Stripe price ID: price_unknown',
    );
  });
});

// ---------------------------------------------------------------------------
// resolveTopUpCredits
// ---------------------------------------------------------------------------

describe('resolveTopUpCredits', () => {
  it('returns correct credits for known top-up prices', () => {
    expect(resolveTopUpCredits('price_topup_10_test')).toBe(10);
    expect(resolveTopUpCredits('price_topup_25_test')).toBe(25);
    expect(resolveTopUpCredits('price_topup_50_test')).toBe(50);
  });

  it('returns null for unknown price ID', () => {
    expect(resolveTopUpCredits('price_topup_unknown')).toBeNull();
  });
});
