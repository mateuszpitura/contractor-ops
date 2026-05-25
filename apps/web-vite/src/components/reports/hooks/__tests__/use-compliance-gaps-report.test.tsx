/**
 * `useComplianceGapsReport` — contractors with compliance gaps. Covers
 * loading/empty/error/success + drill-down client-side filter
 * (critical→red etc) + export mutation toast/invalidate.
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
import { useComplianceGapsReport } from '../use-compliance-gaps-report.js';

const trpcProxy = createTRPCProxy();

function row(id: string, health: 'red' | 'yellow' | 'green') {
  return {
    contractorId: id,
    contractorName: `Name ${id}`,
    missingDocuments: 1,
    contractStatus: 'ACTIVE',
    overdueTasks: 0,
    health,
  };
}

describe('useComplianceGapsReport', () => {
  it('loading state: queries pending, data empty', () => {
    setTRPCMock({
      'report.complianceGaps': () => new Promise(() => undefined),
      'report.complianceGapsChart': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    expect(result.current.tableQuery.isLoading).toBe(true);
    expect(result.current.tableData).toEqual([]);
    expect(result.current.chartData).toEqual([]);
  });

  it('empty state: settled with no rows', async () => {
    setTRPCMock({
      'report.complianceGaps': () => ({ items: [], total: 0 }),
      'report.complianceGapsChart': () => ({ critical: 0, warning: 0, ok: 0 }),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    await waitFor(() => expect(result.current.tableQuery.isLoading).toBe(false));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('success state: rows + chart wrapped in array', async () => {
    setTRPCMock({
      'report.complianceGaps': () => ({
        items: [row('a', 'red'), row('b', 'yellow'), row('c', 'green')],
        total: 3,
      }),
      'report.complianceGapsChart': () => ({ critical: 1, warning: 1, ok: 1 }),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    await waitFor(() => expect(result.current.tableData.length).toBe(3));
    expect(result.current.totalCount).toBe(3);
    expect(result.current.chartData).toEqual([{ critical: 1, warning: 1, ok: 1 }]);
  });

  it('error state: tableQuery.isError set; retry triggers refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'report.complianceGaps': () => {
        calls += 1;
        throw new Error('boom');
      },
      'report.complianceGapsChart': () => ({ critical: 0, warning: 0, ok: 0 }),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    await waitFor(() => expect(result.current.tableQuery.isError).toBe(true));
    const before = calls;
    act(() => result.current.handleTableRetry());
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it('handleDrillDown filters tableData client-side by mapped health bucket', async () => {
    setTRPCMock({
      'report.complianceGaps': () => ({
        items: [row('a', 'red'), row('b', 'yellow'), row('c', 'green')],
        total: 3,
      }),
      'report.complianceGapsChart': () => ({ critical: 1, warning: 1, ok: 1 }),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    await waitFor(() => expect(result.current.tableData.length).toBe(3));
    act(() => result.current.handleDrillDown('critical'));
    expect(result.current.drillDownHealth).toBe('critical');
    expect(result.current.tableData.every(r => r.health === 'red')).toBe(true);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.drillDownLabel).toBe('healthCritical');
  });

  it('handleClearDrillDown restores the unfiltered list', async () => {
    setTRPCMock({
      'report.complianceGaps': () => ({
        items: [row('a', 'red'), row('b', 'green')],
        total: 2,
      }),
      'report.complianceGapsChart': () => ({ critical: 1, warning: 0, ok: 1 }),
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    await waitFor(() => expect(result.current.tableData.length).toBe(2));
    act(() => result.current.handleDrillDown('critical'));
    act(() => result.current.handleClearDrillDown());
    expect(result.current.drillDownHealth).toBeNull();
    expect(result.current.tableData.length).toBe(2);
  });

  it('export success: toast.success + invalidate', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'report.complianceGaps': () => ({ items: [], total: 0 }),
      'report.complianceGapsChart': () => ({ critical: 0, warning: 0, ok: 0 }),
      'report.exportComplianceGaps': () => ({ jobId: 'job-1' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useComplianceGapsReport());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleExportAll());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('export error: toast.error fired', async () => {
    toastError.mockClear();
    setTRPCMock({
      'report.complianceGaps': () => ({ items: [], total: 0 }),
      'report.complianceGapsChart': () => ({ critical: 0, warning: 0, ok: 0 }),
      'report.exportComplianceGaps': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => useComplianceGapsReport());
    act(() => result.current.handleExportPage());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
