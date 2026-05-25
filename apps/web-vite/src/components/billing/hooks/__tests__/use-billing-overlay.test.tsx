/**
 * Hook spec for `useBillingOverlay` — drives the global trial banner /
 * past-due banner / soft-block modal. Covers each subscription-state
 * branch (TRIALING / ACTIVE / PAST_DUE / CANCELED / null) and the
 * `handleUpgrade` + `handleSelectPlan` callbacks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

const routerPush = vi.fn();
vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  Link: ({ children }: { children: unknown }) => children,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useBillingOverlay } from '../use-billing-overlay.js';

const trpcProxy = createTRPCProxy();

let originalLocation: Location;
function stubLocation() {
  originalLocation = window.location;
  // @ts-expect-error — replace `location` for the duration of the test
  delete window.location;
  // @ts-expect-error — minimal stub
  window.location = {
    ...originalLocation,
    href: 'http://localhost/en/dashboard',
  } as Location;
}

beforeEach(() => {
  routerPush.mockReset();
  stubLocation();
});

afterEach(() => {
  // @ts-expect-error — restore
  window.location = originalLocation;
});

describe('useBillingOverlay', () => {
  it('no subscription: returns inactive overlay (no banner / modal)', async () => {
    setTRPCMock({ 'billing.getSubscription': () => null });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.subscription).toBeNull());
    expect(result.current.showTrialBanner).toBe(false);
    expect(result.current.isPastDue).toBe(false);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.isTrialExpired).toBe(false);
  });

  it('TRIALING with future trialEnd: shows trial banner, not expired', async () => {
    const trialEnd = new Date(Date.now() + 3 * 86_400_000).toISOString();
    setTRPCMock({
      'billing.getSubscription': () => ({
        tier: 'PRO',
        status: 'TRIALING',
        trialEnd,
      }),
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.showTrialBanner).toBe(true));
    expect(result.current.isTrialExpired).toBe(false);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.trialEnd).toBeInstanceOf(Date);
  });

  it('TRIALING with past trialEnd: trial expired, soft-block triggered', async () => {
    const trialEnd = new Date(Date.now() - 86_400_000).toISOString();
    setTRPCMock({
      'billing.getSubscription': () => ({
        tier: 'PRO',
        status: 'TRIALING',
        trialEnd,
      }),
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.isTrialExpired).toBe(true));
    expect(result.current.showTrialBanner).toBe(false);
  });

  it('PAST_DUE status: surfaces past-due banner, not blocked modal', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ status: 'PAST_DUE', trialEnd: null, tier: 'PRO' }),
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.isPastDue).toBe(true));
    expect(result.current.isBlocked).toBe(false);
  });

  it.each([
    'CANCELED',
    'UNPAID',
    'INCOMPLETE',
    'INCOMPLETE_EXPIRED',
    'PAUSED',
  ])('%s status: flagged as blocked', async status => {
    setTRPCMock({
      'billing.getSubscription': () => ({ status, trialEnd: null, tier: 'PRO' }),
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.isBlocked).toBe(true));
  });

  it('ACTIVE status: no banner, no modal', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ status: 'ACTIVE', trialEnd: null, tier: 'PRO' }),
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.subscription).not.toBeNull());
    expect(result.current.showTrialBanner).toBe(false);
    expect(result.current.isPastDue).toBe(false);
    expect(result.current.isBlocked).toBe(false);
  });

  it('handleUpgrade routes to /settings?tab=billing via i18n router', async () => {
    setTRPCMock({ 'billing.getSubscription': () => null });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.subscription).toBeNull());
    act(() => result.current.handleUpgrade());
    expect(routerPush).toHaveBeenCalledWith('/settings?tab=billing');
  });

  it('handleSelectPlan invokes the checkout mutation with the priceId', async () => {
    const checkoutSpy = vi.fn(() => ({ sessionUrl: '' }));
    setTRPCMock({
      'billing.getSubscription': () => null,
      'billing.createCheckoutSession': checkoutSpy,
    });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.subscription).toBeNull());
    act(() => result.current.handleSelectPlan('price_pro'));
    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledWith({ priceId: 'price_pro' }));
  });

  it('isSelecting reflects the checkout mutation pending flag', async () => {
    setTRPCMock({ 'billing.getSubscription': () => null });
    const { result } = renderHookWithProviders(() => useBillingOverlay());
    await waitFor(() => expect(result.current.subscription).toBeNull());
    expect(result.current.isSelecting).toBe(false);
  });
});
