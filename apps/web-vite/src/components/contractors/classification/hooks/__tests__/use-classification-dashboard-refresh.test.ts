/**
 * Hook spec for `useClassificationDashboardRefreshButton` — orchestrates the
 * refresh action with a minimum-spinner floor and an aria-live announcement
 * once invalidation settles. `useQueryClient` + `useTRPC` are mocked so the
 * dashboard `pathFilter` invalidation surfaces as a spy without hitting the
 * real React Query store.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateQueriesSpy = vi.fn<() => Promise<void>>();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesSpy }),
  useMutation: () => ({ mutate: vi.fn(), status: 'idle' }),
  useQuery: () => ({ data: undefined, isPending: false }),
}));

vi.mock('../../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => ({
    classificationDashboard: { pathFilter: () => ({ queryKey: ['classificationDashboard'] }) },
  }),
}));

vi.mock('../../../../layout/feature-flag-context.js', () => ({
  useFlag: () => false,
}));

vi.mock('../../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => `t:${key}`,
}));

import { useClassificationDashboardRefreshButton } from '../use-classification-dashboard.js';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  invalidateQueriesSpy.mockReset();
});

describe('useClassificationDashboardRefreshButton', () => {
  it('initialises idle (loading=false, empty announcement)', () => {
    invalidateQueriesSpy.mockResolvedValue();
    const { result } = renderHook(() => useClassificationDashboardRefreshButton());

    expect(result.current.busy).toBe(false);
    expect(result.current.announcement).toBe('');
    expect(typeof result.current.onRefresh).toBe('function');
  });

  it('flips busy=true during invalidation and emits the aria announcement on success', async () => {
    let resolveInvalidate: () => void = () => undefined;
    invalidateQueriesSpy.mockReturnValue(
      new Promise<void>(resolve => {
        resolveInvalidate = resolve;
      }),
    );

    const { result } = renderHook(() => useClassificationDashboardRefreshButton());

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.onRefresh();
    });

    expect(result.current.busy).toBe(true);
    expect(result.current.announcement).toBe('');

    resolveInvalidate();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await refreshPromise;
    });

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
    expect(result.current.announcement).toBe('t:refreshAnnouncement');
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
  });

  it('resets busy and surfaces the announcement even when invalidation rejects (error path)', async () => {
    invalidateQueriesSpy.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useClassificationDashboardRefreshButton());

    await act(async () => {
      await result.current.onRefresh().catch(() => undefined);
      await vi.advanceTimersByTimeAsync(500);
    });

    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
    expect(result.current.announcement).toBe('t:refreshAnnouncement');
  });

  it('honours the 500ms minimum-spinner floor when invalidation resolves immediately', async () => {
    invalidateQueriesSpy.mockResolvedValue();

    const { result } = renderHook(() => useClassificationDashboardRefreshButton());

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.onRefresh();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await refreshPromise;
    });
    expect(result.current.busy).toBe(false);
  });
});
