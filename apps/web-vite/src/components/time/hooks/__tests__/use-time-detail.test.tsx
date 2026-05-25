/**
 * `useTimeDetail` — per-contractor timesheet review hook.
 *
 * Covers:
 *   - list query disabled when contractorId empty
 *   - timesheetId derived from first list item
 *   - detail query enabled only once timesheetId resolves
 *   - approve / reject mutations: success toast + router.push('/time')
 *   - approve / reject mutations: error toast on failure
 *   - handleBack pushes back to /time
 *   - approve/reject no-op when timesheetId is missing
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
import { useTimeDetail } from '../use-time-detail.js';

const trpcProxy = createTRPCProxy();

const TS_ID = 'ts-42';
const CONTRACTOR_ID = 'contractor-1';
const WEEK = '2026-01-05';

const detailFixture = {
  id: TS_ID,
  contractor: { id: CONTRACTOR_ID, legalName: 'Acme GmbH', email: null },
  weekStartDate: WEEK,
  status: 'SUBMITTED' as const,
  totalMinutes: 480,
  entries: [],
};

beforeEach(() => {
  routerPush.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('useTimeDetail', () => {
  it('disables the list query while contractorId is empty', () => {
    setTRPCMock({
      'time.listAll': () => {
        throw new Error('list query should not run without contractorId');
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail('', null));
    expect(result.current.listQuery.isLoading).toBe(false);
    expect(result.current.timesheetId).toBeUndefined();
    expect(result.current.timesheet).toBeUndefined();
  });

  it('resolves timesheetId from the list and then fetches the detail', async () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [{ id: TS_ID }], nextCursor: null }),
      'time.getTimesheet': (input?: unknown) => {
        const cast = input as { timesheetId: string } | undefined;
        expect(cast?.timesheetId).toBe(TS_ID);
        return detailFixture;
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, WEEK));
    await waitFor(() => expect(result.current.timesheetId).toBe(TS_ID));
    await waitFor(() => expect(result.current.timesheet).toEqual(detailFixture));
  });

  it('approve mutation emits success toast and navigates back to /time', async () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [{ id: TS_ID }], nextCursor: null }),
      'time.getTimesheet': () => detailFixture,
      'time.approve': (input?: unknown) => {
        expect((input as { timesheetId: string }).timesheetId).toBe(TS_ID);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, WEEK));
    await waitFor(() => expect(result.current.timesheetId).toBe(TS_ID));
    act(() => result.current.handleApprove());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(routerPush).toHaveBeenCalledWith('/time');
  });

  it('reject mutation passes reason and navigates back to /time', async () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [{ id: TS_ID }], nextCursor: null }),
      'time.getTimesheet': () => detailFixture,
      'time.reject': (input?: unknown) => {
        const cast = input as { timesheetId: string; reason: string };
        expect(cast.timesheetId).toBe(TS_ID);
        expect(cast.reason).toBe('missing dates');
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, WEEK));
    await waitFor(() => expect(result.current.timesheetId).toBe(TS_ID));
    act(() => result.current.handleReject('missing dates'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(routerPush).toHaveBeenCalledWith('/time');
  });

  it('approve mutation surfaces error toast on failure (no nav)', async () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [{ id: TS_ID }], nextCursor: null }),
      'time.getTimesheet': () => detailFixture,
      'time.approve': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, WEEK));
    await waitFor(() => expect(result.current.timesheetId).toBe(TS_ID));
    act(() => result.current.handleApprove());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(routerPush).not.toHaveBeenCalledWith('/time');
  });

  it('handleBack pushes /time without touching mutations', () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, null));
    act(() => result.current.handleBack());
    expect(routerPush).toHaveBeenCalledWith('/time');
  });

  it('approve / reject are no-ops when timesheetId is missing', () => {
    setTRPCMock({
      'time.listAll': () => ({ items: [] }),
      'time.approve': () => {
        throw new Error('should not be called');
      },
      'time.reject': () => {
        throw new Error('should not be called');
      },
    });
    const { result } = renderHookWithProviders(() => useTimeDetail(CONTRACTOR_ID, null));
    act(() => result.current.handleApprove());
    act(() => result.current.handleReject('x'));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
