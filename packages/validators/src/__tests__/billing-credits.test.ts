import { describe, expect, it } from 'vitest';
import { billingCreditDenialReason } from '../billing-credits.js';
import type { BillingCreditDenialReason } from '../billing-credits.js';

describe('billingCreditDenialReason', () => {
  it('exposes noSubscription reason', () => {
    expect(billingCreditDenialReason.noSubscription).toBe('noSubscription');
  });

  it('exposes creditsExhausted reason', () => {
    expect(billingCreditDenialReason.creditsExhausted).toBe('creditsExhausted');
  });

  it('has exactly two denial reasons', () => {
    expect(Object.keys(billingCreditDenialReason)).toHaveLength(2);
  });

  it('values are assignable to BillingCreditDenialReason type', () => {
    const reason: BillingCreditDenialReason = billingCreditDenialReason.noSubscription;
    expect(reason).toBe('noSubscription');
  });
});
