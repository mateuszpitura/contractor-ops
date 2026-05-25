import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { usePortalTime } = await import('../hooks/use-portal-time.js');

const EMPTY_HISTORY = { items: [] };

describe('usePortalTime', () => {
  it('loading: both timesheet + contracts pending', () => {
    setTRPCMock({
      'portalTime.getTimesheet': () => new Promise(() => undefined),
      'portalTime.getActiveContracts': () => new Promise(() => undefined),
      'portalTime.getConnectedProviders': () => [],
      'portalTime.listTimesheets': () => EMPTY_HISTORY,
      'portalTime.saveDraftEntries': () => ({}),
      'portalTime.createSingleEntry': () => ({}),
      'portalTime.submitTimesheet': () => ({}),
      'portalTime.syncExternal': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTime());
    expect(result.current.isLoading).toBe(true);
    clearTRPCMock();
  });

  it('empty: zero-state defaults render without errors', async () => {
    setTRPCMock({
      'portalTime.getTimesheet': () => null,
      'portalTime.getActiveContracts': () => [],
      'portalTime.getConnectedProviders': () => [],
      'portalTime.listTimesheets': () => EMPTY_HISTORY,
      'portalTime.saveDraftEntries': () => ({}),
      'portalTime.createSingleEntry': () => ({}),
      'portalTime.submitTimesheet': () => ({}),
      'portalTime.syncExternal': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTime());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contracts).toEqual([]);
    expect(result.current.currentWeekMinutes).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.approvedMonthMinutes).toBe(0);
    expect(result.current.connectedProviders.size).toBe(0);
    expect(result.current.timesheetStatus).toBe('DRAFT');
    clearTRPCMock();
  });

  it('error: getTimesheet query failure flips isError', async () => {
    setTRPCMock({
      'portalTime.getTimesheet': () => {
        throw new Error('boom');
      },
      'portalTime.getActiveContracts': () => [],
      'portalTime.getConnectedProviders': () => [],
      'portalTime.listTimesheets': () => EMPTY_HISTORY,
      'portalTime.saveDraftEntries': () => ({}),
      'portalTime.createSingleEntry': () => ({}),
      'portalTime.submitTimesheet': () => ({}),
      'portalTime.syncExternal': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTime());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    clearTRPCMock();
  });

  it('success: derives totals + pending count from history', async () => {
    setTRPCMock({
      'portalTime.getTimesheet': () => ({
        id: 'ts-1',
        status: 'DRAFT',
        totalMinutes: 480,
        entries: [],
        rejectionReason: null,
      }),
      'portalTime.getActiveContracts': () => [{ id: 'c1', title: 'Engagement A' }],
      'portalTime.getConnectedProviders': () => [{ provider: 'CLOCKIFY' }],
      'portalTime.listTimesheets': () => ({
        items: [{ id: 'h1', status: 'SUBMITTED', totalMinutes: 600, weekStartDate: '2026-05-05' }],
      }),
      'portalTime.saveDraftEntries': () => ({}),
      'portalTime.createSingleEntry': () => ({}),
      'portalTime.submitTimesheet': () => ({}),
      'portalTime.syncExternal': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTime());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentWeekMinutes).toBe(480);
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.connectedProviders.has('CLOCKIFY')).toBe(true);
    expect(result.current.timesheetStatus).toBe('DRAFT');
    expect(result.current.isDisabled).toBe(false);
    clearTRPCMock();
  });

  it('handleSubmitTimesheet: emits success toast on mutation success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'portalTime.getTimesheet': () => ({
        id: 'ts-1',
        status: 'DRAFT',
        totalMinutes: 0,
        entries: [],
        rejectionReason: null,
      }),
      'portalTime.getActiveContracts': () => [],
      'portalTime.getConnectedProviders': () => [],
      'portalTime.listTimesheets': () => EMPTY_HISTORY,
      'portalTime.saveDraftEntries': () => ({}),
      'portalTime.createSingleEntry': () => ({}),
      'portalTime.submitTimesheet': () => ({ ok: true }),
      'portalTime.syncExternal': () => ({}),
    });
    const { result } = renderHookWithProviders(() => usePortalTime());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.handleSubmitTimesheet();
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });
});
