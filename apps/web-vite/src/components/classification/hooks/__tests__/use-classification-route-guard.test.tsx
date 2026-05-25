/**
 * `useClassificationRouteGuard` — gates the classification routes on the
 * `module.classification-engine` feature flag and exposes the `featureFlags.getBag`
 * query loading state to the container.
 *
 * Covers:
 *   - loading: pending bag → isPending=true
 *   - empty / flag disabled: classificationEnabled=false
 *   - success / flag enabled: classificationEnabled=true after query resolves
 *   - error: query rejects → isPending settles, useFlag fallback honoured
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useFlagMock = vi.fn();

vi.mock('../../../layout/feature-flag-context.js', () => ({
  useFlag: (key: string) => useFlagMock(key),
}));

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
import { useClassificationRouteGuard } from '../use-classification-route-guard.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  setTRPCMock({});
  useFlagMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useClassificationRouteGuard', () => {
  it('reports isPending while the feature-flag bag query is in flight (loading)', () => {
    useFlagMock.mockReturnValue(false);
    // No mock registered → query hangs in pending until rejection; check the
    // synchronous initial render.
    setTRPCMock({
      'featureFlags.getBag': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useClassificationRouteGuard());
    expect(result.current.isPending).toBe(true);
    expect(result.current.classificationEnabled).toBe(false);
  });

  it('returns classificationEnabled=false when the flag is off (empty / unauthorised)', async () => {
    useFlagMock.mockReturnValue(false);
    setTRPCMock({ 'featureFlags.getBag': () => ({}) });
    const { result } = renderHookWithProviders(() => useClassificationRouteGuard());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.classificationEnabled).toBe(false);
    expect(useFlagMock).toHaveBeenCalledWith('module.classification-engine');
  });

  it('returns classificationEnabled=true once the bag resolves and the flag is on (success)', async () => {
    useFlagMock.mockReturnValue(true);
    setTRPCMock({ 'featureFlags.getBag': () => ({}) });
    const { result } = renderHookWithProviders(() => useClassificationRouteGuard());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.classificationEnabled).toBe(true);
  });

  it('settles isPending=false when the bag query rejects (error → flag fallback)', async () => {
    useFlagMock.mockReturnValue(false);
    setTRPCMock({
      'featureFlags.getBag': () => {
        throw new Error('flag service unavailable');
      },
    });
    const { result } = renderHookWithProviders(() => useClassificationRouteGuard());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.classificationEnabled).toBe(false);
  });
});
