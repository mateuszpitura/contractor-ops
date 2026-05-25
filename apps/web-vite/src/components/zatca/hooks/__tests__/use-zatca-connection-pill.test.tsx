/**
 * `useZatcaConnectionPill` — derives the dashboard connection pill from
 * `getOnboardingState`. Covers all four `ZatcaDerivedStatus` branches plus
 * the initial loading flag.
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
import { useZatcaConnectionPill } from '../use-zatca-connection-pill.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaConnectionPill', () => {
  beforeEach(() => {
    setTRPCMock({});
  });

  it('isLoading=true while the onboarding state query is pending', () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useZatcaConnectionPill());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns DISCONNECTED for a fresh org parked on the tax-details step', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'tax_details',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaConnectionPill());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe('DISCONNECTED');
  });

  it('returns IN_PROGRESS once onboarding has advanced past tax-details', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'compliance_csid',
        productionCertActive: false,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaConnectionPill());
    await waitFor(() => expect(result.current.status).toBe('IN_PROGRESS'));
  });

  it('returns CONNECTED when production cert is active', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => ({
        currentStep: 'production_certificate',
        productionCertActive: true,
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaConnectionPill());
    await waitFor(() => expect(result.current.status).toBe('CONNECTED'));
  });

  it('returns ERROR when the query rejects', async () => {
    setTRPCMock({
      'zatca.getOnboardingState': () => {
        throw new Error('upstream down');
      },
    });
    const { result } = renderHookWithProviders(() => useZatcaConnectionPill());
    await waitFor(() => expect(result.current.status).toBe('ERROR'));
  });
});
