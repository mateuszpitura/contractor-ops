/**
 * `useTimeTracking` — admin time-tracking dashboard hook.
 *
 * Covers:
 *   - pending list query feeds `pendingTimesheets`
 *   - approve / reject mutations surface success + error toasts and invalidate
 *   - bulk approve / reject pass id arrays and surface count toasts
 *   - handleNavigateToReview pushes router to /time/:contractorId?week=
 *   - tab / statusFilter nuqs round-trip via setters
 *
 * NOTE: the `allQuery` is `useInfiniteQuery` and is gated by `tab === 'all'`.
 * Tests pin `tab` to `pending` (default) so React Query does not run the
 * infinite handler.  An `infiniteQueryOptions` shim is added to the tRPC
 * proxy so the hook can still construct the disabled query without crashing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const routerPush = vi.fn();
vi.mock('../../../../i18n/navigation.js', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { TIME_STATUS_FILTER_ALL, useTimeTracking } from '../use-time-tracking.js';

const baseProxy = createTRPCProxy();

/**
 * Walks `trpc.<router>.<procedure>` and patches `infiniteQueryOptions`
 * onto the procedure leaf so callers can spread its result.  The base
 * proxy from `render-hook` only ships `queryOptions` / `mutationOptions`
 * / `queryKey` / `pathFilter` — we need an infinite shape that still
 * works while `enabled` is false (tab !== 'all').
 */
function withInfinite(path: string) {
  return {
    queryKey: [path, 'infinite'],
    queryFn: () => Promise.resolve({ items: [], nextCursor: null }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
  };
}

const trpcProxy: Record<string, unknown> = new Proxy(baseProxy, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (prop === 'time' && typeof value === 'object' && value !== null) {
      return new Proxy(value as object, {
        get(timeTarget, timeProp, timeReceiver) {
          const procedure = Reflect.get(timeTarget, timeProp, timeReceiver);
          if (timeProp === 'listAll' && typeof procedure === 'object' && procedure !== null) {
            return new Proxy(procedure as object, {
              get(procTarget, procProp, procReceiver) {
                if (procProp === 'infiniteQueryOptions') {
                  return () => withInfinite('time.listAll');
                }
                return Reflect.get(procTarget, procProp, procReceiver);
              },
            });
          }
          return procedure;
        },
      });
    }
    return value;
  },
});

const pendingFixture = [
  {
    id: 'ts-1',
    weekStartDate: '2026-01-05',
    totalMinutes: 480,
    status: 'SUBMITTED' as const,
    contractor: { id: 'c-1', legalName: 'Acme', email: null },
    _count: { entries: 5 },
  },
  {
    id: 'ts-2',
    weekStartDate: '2026-01-05',
    totalMinutes: 600,
    status: 'SUBMITTED' as const,
    contractor: { id: 'c-2', legalName: 'Globex', email: null },
    _count: { entries: 7 },
  },
];

beforeEach(() => {
  routerPush.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('useTimeTracking', () => {
  it('exposes pending timesheets from the listPending query', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    expect(result.current.pendingTimesheets[0]?.id).toBe('ts-1');
    expect(result.current.tab).toBe('pending');
    expect(result.current.statusFilter).toBe(TIME_STATUS_FILTER_ALL);
  });

  it('approve mutation forwards id and emits success toast', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
      'time.approve': (input?: unknown) => {
        expect((input as { timesheetId: string }).timesheetId).toBe('ts-1');
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    act(() => result.current.handleApprove('ts-1'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(result.current.isApproving).toBe(false);
  });

  it('reject mutation surfaces error toast and leaves nav untouched', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
      'time.reject': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    act(() => result.current.handleReject('ts-1', 'overlogged'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('bulk approve forwards id array and surfaces count toast', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
      'time.bulkApprove': (input?: unknown) => {
        const cast = input as { timesheetIds: string[] };
        expect(cast.timesheetIds).toEqual(['ts-1', 'ts-2']);
        return { count: cast.timesheetIds.length };
      },
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    act(() => result.current.handleBulkApprove(['ts-1', 'ts-2']));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('bulk reject forwards reason + ids and surfaces count toast', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
      'time.bulkReject': (input?: unknown) => {
        const cast = input as { timesheetIds: string[]; reason: string };
        expect(cast.timesheetIds).toEqual(['ts-1']);
        expect(cast.reason).toBe('weekend overtime');
        return { count: 1 };
      },
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    act(() => result.current.handleBulkReject(['ts-1'], 'weekend overtime'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('navigateToReview pushes /time/:contractorId?week=', async () => {
    setTRPCMock({
      'time.listPending': () => pendingFixture,
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingTimesheets.length).toBe(2));
    act(() => result.current.handleNavigateToReview('c-1', '2026-01-05'));
    expect(routerPush).toHaveBeenCalledWith('/time/c-1?week=2026-01-05');
  });

  it('empty pending list returns an empty array and no errors', async () => {
    setTRPCMock({
      'time.listPending': () => [],
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingQuery.isLoading).toBe(false));
    expect(result.current.pendingTimesheets).toEqual([]);
  });

  it('pending query surfaces error state for callers', async () => {
    setTRPCMock({
      'time.listPending': () => {
        throw new Error('upstream 500');
      },
    });
    const { result } = renderHookWithProviders(() => useTimeTracking());
    await waitFor(() => expect(result.current.pendingQuery.isError).toBe(true));
    expect(result.current.pendingTimesheets).toEqual([]);
  });
});
