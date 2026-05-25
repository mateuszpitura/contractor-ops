/**
 * `useSkontoApplyEligibility` — gating on enabled/invoiceId, NO_SKONTO_CONFIGURED
 * eligibility short-circuit, and derived discount percent.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useSkontoApplyEligibility } from '../use-skonto-apply-eligibility.js';

const trpcProxy = createTRPCProxy();

describe('useSkontoApplyEligibility', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('hides checkbox when feature flag is disabled (no eligibility data)', () => {
    setTRPCMock({
      'skonto.evaluateForInvoice': () => undefined,
    });

    const { result } = renderHookWithProviders(() => useSkontoApplyEligibility('inv-1', false));

    expect(result.current.showCheckbox).toBe(false);
    expect(result.current.isWithinWindow).toBe(false);
  });

  it('hides checkbox when eligibilityReason is NO_SKONTO_CONFIGURED', async () => {
    setTRPCMock({
      'skonto.evaluateForInvoice': () => ({
        eligibilityReason: 'NO_SKONTO_CONFIGURED',
        eligible: false,
        netAmountMinor: 0,
        discountAmountMinor: 0,
        discountedAmountMinor: 0,
        discountDeadline: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useSkontoApplyEligibility('inv-1', true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showCheckbox).toBe(false);
  });

  it('exposes discount details when eligible', async () => {
    setTRPCMock({
      'skonto.evaluateForInvoice': () => ({
        eligibilityReason: 'OK',
        eligible: true,
        netAmountMinor: 100_000,
        discountAmountMinor: 3_000,
        discountedAmountMinor: 97_000,
        discountDeadline: '2026-06-01',
      }),
    });

    const { result } = renderHookWithProviders(() => useSkontoApplyEligibility('inv-1', true));

    await waitFor(() => expect(result.current.showCheckbox).toBe(true));
    expect(result.current.isWithinWindow).toBe(true);
    expect(result.current.discountPercent).toBe(3);
    expect(result.current.discountAmountMinor).toBe(3_000);
    expect(result.current.originalAmountMinor).toBe(100_000);
    expect(result.current.discountedAmountMinor).toBe(97_000);
    expect(typeof result.current.windowExpiryDate).toBe('string');
  });
});
