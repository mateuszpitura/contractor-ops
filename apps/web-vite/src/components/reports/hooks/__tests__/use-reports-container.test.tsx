/**
 * `useReportsContainer` — top-level reports page state. Covers:
 *   - permission gate (`canReadReports`)
 *   - default report selection + report change via nuqs
 *   - default date range (last 3 months) + handleDateChange
 *   - locale forwarding for the unauthorized redirect
 */

import { describe, expect, it, vi } from 'vitest';

const usePermissionsMock = vi.fn();
const useLocaleMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => usePermissionsMock(),
}));

vi.mock('../../../../i18n/navigation.js', () => ({
  useLocale: () => useLocaleMock(),
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => ({}),
  usePortalTRPC: () => ({}),
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useReportsContainer } from '../use-reports-container.js';

describe('useReportsContainer', () => {
  it('grants access when the viewer can read reports', () => {
    usePermissionsMock.mockReturnValue({ can: () => true, isPlatformAdmin: false });
    useLocaleMock.mockReturnValue('en');
    const { result } = renderHookWithProviders(() => useReportsContainer());
    expect(result.current.canReadReports).toBe(true);
    expect(result.current.locale).toBe('en');
  });

  it('blocks access when the viewer cannot read reports', () => {
    usePermissionsMock.mockReturnValue({ can: () => false, isPlatformAdmin: false });
    useLocaleMock.mockReturnValue('de');
    const { result } = renderHookWithProviders(() => useReportsContainer());
    expect(result.current.canReadReports).toBe(false);
    expect(result.current.locale).toBe('de');
  });

  it('defaults to spend-contractor and exposes a non-empty date range', () => {
    usePermissionsMock.mockReturnValue({ can: () => true, isPlatformAdmin: false });
    useLocaleMock.mockReturnValue('en');
    const { result } = renderHookWithProviders(() => useReportsContainer());
    expect(result.current.report).toBe('spend-contractor');
    expect(typeof result.current.dateFrom).toBe('string');
    expect(typeof result.current.dateTo).toBe('string');
    expect(new Date(result.current.dateFrom).getTime()).toBeLessThan(
      new Date(result.current.dateTo).getTime(),
    );
  });

  it('handleReportChange swaps the active report', async () => {
    usePermissionsMock.mockReturnValue({ can: () => true, isPlatformAdmin: false });
    useLocaleMock.mockReturnValue('en');
    const { result } = renderHookWithProviders(() => useReportsContainer());
    await act(async () => {
      result.current.handleReportChange('overdue-invoices');
    });
    expect(result.current.report).toBe('overdue-invoices');
  });

  it('handleDateChange updates both dateFrom and dateTo', async () => {
    usePermissionsMock.mockReturnValue({ can: () => true, isPlatformAdmin: false });
    useLocaleMock.mockReturnValue('en');
    const { result } = renderHookWithProviders(() => useReportsContainer());
    const from = '2026-01-01T00:00:00.000Z';
    const to = '2026-02-01T00:00:00.000Z';
    await act(async () => {
      result.current.handleDateChange(from, to);
    });
    expect(result.current.dateFrom).toBe(from);
    expect(result.current.dateTo).toBe(to);
  });
});
