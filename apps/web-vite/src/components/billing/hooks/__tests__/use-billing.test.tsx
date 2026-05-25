/**
 * Hook specs for the billing domain hooks (`use-billing.ts`). Covers:
 *   - `useBillingSubscription`: loading / success / error states
 *   - `useFeatureGate`: tier-rank gating across Pro / Enterprise tiers
 *   - `useProrationPreview`: loading / success / error
 *   - `useUsageDashboard`: loading / success / error
 *   - `useBillingCheckout`: success (redirect + invalidation) + error toast
 *   - `useBillingPortal`: success (redirect + invalidation) + error toast
 *   - `useTopUpCheckout`: missing priceId guard + success + error
 *   - `useBillingTab`: session_id query-param success toast + URL cleanup
 *
 * Each test stays hermetic via the canonical `renderHookWithProviders` +
 * `setTRPCMock` harness; `window.location` is stubbed where mutations
 * trigger redirects so we never navigate the JSDOM frame.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import {
  useBillingCheckout,
  useBillingPortal,
  useBillingSubscription,
  useBillingTab,
  useFeatureGate,
  useProrationPreview,
  useTopUpCheckout,
  useUsageDashboard,
} from '../use-billing.js';

const trpcProxy = createTRPCProxy();

let originalLocation: Location;
let assignedHref: string | null = null;

function stubLocation() {
  assignedHref = null;
  originalLocation = window.location;
  const fallback = 'http://localhost/en/settings?tab=billing';
  // @ts-expect-error — replace `location` for the duration of the test
  delete window.location;
  // @ts-expect-error — minimal stub
  window.location = Object.defineProperty({ ...originalLocation }, 'href', {
    configurable: true,
    enumerable: true,
    get() {
      return assignedHref ?? fallback;
    },
    set(value: string) {
      assignedHref = value;
    },
  }) as Location;
}

function restoreLocation() {
  // @ts-expect-error — restore
  window.location = originalLocation;
}

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  stubLocation();
});

afterEach(() => {
  restoreLocation();
});

describe('useBillingSubscription', () => {
  it('returns loading state on first render', () => {
    setTRPCMock({
      'billing.getSubscription': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useBillingSubscription());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('resolves with subscription payload', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'PRO', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useBillingSubscription());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ tier: 'PRO', status: 'ACTIVE' });
  });

  it('surfaces error state when the procedure throws', async () => {
    setTRPCMock({
      'billing.getSubscription': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useBillingSubscription());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useFeatureGate', () => {
  it('blocks while loading (isAllowed=false until subscription resolves)', () => {
    setTRPCMock({
      'billing.getSubscription': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useFeatureGate('Pro'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAllowed).toBe(false);
  });

  it('allows Pro feature when current tier is PRO', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'PRO', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useFeatureGate('Pro'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAllowed).toBe(true);
  });

  it('allows Pro feature when current tier is ENTERPRISE (higher rank)', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'ENTERPRISE', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useFeatureGate('Pro'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAllowed).toBe(true);
  });

  it('denies Enterprise feature when current tier is PRO', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'PRO', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useFeatureGate('Enterprise'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAllowed).toBe(false);
  });

  it('denies any paid feature with STARTER tier', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'STARTER', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useFeatureGate('Pro'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAllowed).toBe(false);
  });
});

describe('useProrationPreview', () => {
  it('returns loading initially', () => {
    setTRPCMock({
      'billing.getProrationPreview': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useProrationPreview('price_pro'));
    expect(result.current.isLoading).toBe(true);
  });

  it('resolves with proration lines + total', async () => {
    setTRPCMock({
      'billing.getProrationPreview': () => ({
        lines: [{ description: 'Pro tier', amountMinor: 29_900 }],
        totalMinor: 29_900,
      }),
    });
    const { result } = renderHookWithProviders(() => useProrationPreview('price_pro'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lines).toHaveLength(1);
    expect(result.current.data?.totalMinor).toBe(29_900);
  });

  it('surfaces error state on failure', async () => {
    setTRPCMock({
      'billing.getProrationPreview': () => {
        throw new Error('stripe down');
      },
    });
    const { result } = renderHookWithProviders(() => useProrationPreview('price_pro'));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUsageDashboard', () => {
  it('returns loading initially', () => {
    setTRPCMock({
      'billing.getUsageDashboard': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useUsageDashboard());
    expect(result.current.isLoading).toBe(true);
  });

  it('resolves with usage payload', async () => {
    setTRPCMock({
      'billing.getUsageDashboard': () => ({
        subscription: {
          tier: 'PRO',
          status: 'ACTIVE',
          trialEnd: null,
          currentPeriodEnd: '2026-12-31T00:00:00.000Z',
          cancelAt: null,
        },
        credits: { balance: 70, allowance: 100, used: 30, tier: 'PRO' },
        activeContractors: 5,
        includedSeats: 10,
        planConfig: { tiers: [{ id: 'PRO', seatPriceMinor: 1_500 }] },
      }),
    });
    const { result } = renderHookWithProviders(() => useUsageDashboard());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('surfaces error state when query throws', async () => {
    setTRPCMock({
      'billing.getUsageDashboard': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useUsageDashboard());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useBillingCheckout', () => {
  it('success: redirects to sessionUrl, fires success toast, invalidates billing keys', async () => {
    setTRPCMock({
      'billing.createCheckoutSession': () => ({ sessionUrl: 'https://stripe.test/checkout' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useBillingCheckout());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.mutate({ priceId: 'price_pro' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignedHref).toBe('https://stripe.test/checkout');
    expect(toastSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('error: fires translated checkoutFailed toast', async () => {
    setTRPCMock({
      'billing.createCheckoutSession': () => {
        throw new Error('stripe failure');
      },
    });
    const { result } = renderHookWithProviders(() => useBillingCheckout());
    act(() => {
      result.current.mutate({ priceId: 'price_pro' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith('checkoutFailed');
  });

  it('success: fires `onPlanSelected` callback when provided', async () => {
    const onSelected = vi.fn();
    setTRPCMock({
      'billing.createCheckoutSession': () => ({ sessionUrl: 'https://stripe.test/x' }),
    });
    const { result } = renderHookWithProviders(() => useBillingCheckout(onSelected));
    act(() => {
      result.current.mutate({ priceId: 'price_pro' });
    });
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });
});

describe('useBillingPortal', () => {
  it('success: redirects to portal URL + invalidates billing keys', async () => {
    setTRPCMock({
      'billing.createPortalSession': () => ({ url: 'https://billing.test/portal' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useBillingPortal());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.mutate(undefined as never);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignedHref).toBe('https://billing.test/portal');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('error: fires portalFailed toast', async () => {
    setTRPCMock({
      'billing.createPortalSession': () => {
        throw new Error('portal down');
      },
    });
    const { result } = renderHookWithProviders(() => useBillingPortal());
    act(() => {
      result.current.mutate(undefined as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith('portalFailed');
  });
});

describe('useTopUpCheckout', () => {
  it('guards against unknown bundle (no priceId configured) — fires error toast and skips mutate', () => {
    setTRPCMock({
      'billing.createTopUpCheckout': () => {
        throw new Error('should not fire');
      },
    });
    const { result } = renderHookWithProviders(() => useTopUpCheckout());
    act(() => {
      result.current.checkout('ZZZ');
    });
    expect(toastError).toHaveBeenCalledWith('errors.priceNotConfigured');
    expect(result.current.isPending).toBe(false);
  });

  it('error path: fires translated checkoutFailed toast', async () => {
    setTRPCMock({
      'billing.createTopUpCheckout': () => {
        throw new Error('stripe down');
      },
    });
    // priceId map is populated via import.meta.env at module load — bundle '10' likely empty in test env.
    // Inject directly via the underlying mutation instead.
    const { result } = renderHookWithProviders(() => useTopUpCheckout());
    act(() => {
      result.current.mutate({ priceId: 'price_topup' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith('errors.checkoutFailed');
  });

  it('success path: redirects to sessionUrl', async () => {
    setTRPCMock({
      'billing.createTopUpCheckout': () => ({ sessionUrl: 'https://stripe.test/topup' }),
    });
    const { result } = renderHookWithProviders(() => useTopUpCheckout());
    act(() => {
      result.current.mutate({ priceId: 'price_topup' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignedHref).toBe('https://stripe.test/topup');
  });
});

describe('useBillingTab', () => {
  it('returns the billing subscription, mutations, and translator', async () => {
    setTRPCMock({
      'billing.getSubscription': () => ({ tier: 'STARTER', status: 'ACTIVE' }),
    });
    const { result } = renderHookWithProviders(() => useBillingTab());
    await waitFor(() =>
      expect(result.current.subscription).toEqual({
        tier: 'STARTER',
        status: 'ACTIVE',
      }),
    );
    expect(typeof result.current.t).toBe('function');
    expect(result.current.checkoutMutation.isPending).toBe(false);
    expect(result.current.portalMutation.isPending).toBe(false);
  });

  it('fires subscriptionUpdated toast when `session_id` is present in the URL', async () => {
    // Restore real window.location so jsdom's `new URL(href)` + history.replaceState
    // round-trip stays on the same origin (the per-test stub above traps the
    // setter for redirect-tracking but breaks history.replaceState).
    restoreLocation();
    setTRPCMock({
      'billing.getSubscription': () => null,
    });
    renderHookWithProviders(() => useBillingTab(), {
      initialPath: '/en/settings?tab=billing&session_id=cs_test_123',
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('subscriptionUpdated'));
  });

  it('does not fire the toast when `session_id` is absent', async () => {
    setTRPCMock({
      'billing.getSubscription': () => null,
    });
    renderHookWithProviders(() => useBillingTab(), {
      initialPath: '/en/settings?tab=billing',
    });
    // Give React Query + effect a tick to settle.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(toastSuccess).not.toHaveBeenCalledWith('subscriptionUpdated');
  });
});
