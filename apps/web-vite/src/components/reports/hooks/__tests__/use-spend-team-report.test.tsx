/**
 * `useSpendTeamReport` — spend-by-team table + chart + export. Same shape as
 * spend-contractor; key delta is teamName ?? `unassignedTeam` fallback in
 * chart data + drill-down label.
 */

import { describe, expect, it, vi } from 'vitest';

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
import { useSpendTeamReport } from '../use-spend-team-report.js';

const trpcProxy = createTRPCProxy();

const DATE_FROM = '2026-01-01T00:00:00.000Z';
const DATE_TO = '2026-04-01T00:00:00.000Z';

describe('useSpendTeamReport', () => {
  it('loading state: queries pending, derived data empty', () => {
    setTRPCMock({
      'report.spendByTeam': () => new Promise(() => undefined),
      'report.spendByTeamChart': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.chartData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.grandTotal).toBe(0);
    expect(result.current.tableQuery.isLoading).toBe(true);
  });

  it('empty state: settled with no rows', async () => {
    setTRPCMock({
      'report.spendByTeam': () => ({ items: [], total: 0 }),
      'report.spendByTeamChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableQuery.isLoading).toBe(false));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('success state: rows + chart, unassigned team name backfilled', async () => {
    setTRPCMock({
      'report.spendByTeam': () => ({
        items: [
          {
            teamId: 't-1',
            teamName: 'Eng',
            contractorCount: 2,
            invoiceCount: 5,
            totalMinor: 2000,
          },
          {
            teamId: null,
            teamName: null,
            contractorCount: 1,
            invoiceCount: 1,
            totalMinor: 300,
          },
        ],
        total: 2,
        grandTotalMinor: 2300,
      }),
      'report.spendByTeamChart': () => [
        { teamId: null, teamName: null, totalMinor: 300 },
        { teamId: 't-1', teamName: 'Eng', totalMinor: 2000 },
      ],
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableData.length).toBe(2));
    expect(result.current.grandTotal).toBe(2300);
    const unassigned = result.current.chartData.find(c => c.teamId === null);
    expect(unassigned?.teamName).toBe('unassignedTeam');
  });

  it('error state: tableQuery.isError set; retry triggers refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'report.spendByTeam': () => {
        calls += 1;
        throw new Error('boom');
      },
      'report.spendByTeamChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableQuery.isError).toBe(true));
    const before = calls;
    act(() => result.current.handleTableRetry());
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it('handleSortChange resets page; handleDrillDown toggles team id', () => {
    setTRPCMock({
      'report.spendByTeam': () => ({ items: [], total: 0 }),
      'report.spendByTeamChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    act(() => result.current.setPage(4));
    act(() => result.current.handleSortChange('teamName', 'asc'));
    expect(result.current.sortBy).toBe('teamName');
    expect(result.current.page).toBe(1);
    act(() => result.current.handleDrillDown('t-1'));
    expect(result.current.drillDownTeamId).toBe('t-1');
    act(() => result.current.handleDrillDown('t-1'));
    expect(result.current.drillDownTeamId).toBeNull();
  });

  it('export success: toast.success + invalidate', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'report.spendByTeam': () => ({ items: [], total: 0 }),
      'report.spendByTeamChart': () => [],
      'report.exportSpendByTeam': () => ({ jobId: 'job-1' }),
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useSpendTeamReport(DATE_FROM, DATE_TO),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleExportPage());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('export error: toast.error fired', async () => {
    toastError.mockClear();
    setTRPCMock({
      'report.spendByTeam': () => ({ items: [], total: 0 }),
      'report.spendByTeamChart': () => [],
      'report.exportSpendByTeam': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useSpendTeamReport(DATE_FROM, DATE_TO));
    act(() => result.current.handleExportAll());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
