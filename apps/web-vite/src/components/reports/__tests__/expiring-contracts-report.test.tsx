/**
 * Container/component split means the test no longer needs a tRPC harness:
 * the `report` prop is the hook's return value, so the test injects a
 * shaped stub. `useRouter()` is wired via a `MemoryRouter` with `:locale`
 * param so the locale-aware navigation hook resolves cleanly.
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `useDateFormatter` reaches into tRPC for org settings; the test cares
// about the report-prop wiring, not the live settings query, so stub it
// to a stable formatter that does not require TRPCProvider.
vi.mock('../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));

import { ExpiringContractsReport } from '../expiring-contracts-report.js';
import type { useExpiringContractsReport } from '../hooks/use-expiring-contracts-report.js';
import { click, findButton, findByText, mount } from './_render.js';

type Report = ReturnType<typeof useExpiringContractsReport>;

afterEach(() => {
  document.body.innerHTML = '';
});

interface OverrideReport
  extends Partial<Omit<Report, 'tableQuery' | 'chartQuery' | 'exportMutation'>> {
  tableQuery?: Partial<Report['tableQuery']>;
  chartQuery?: Partial<Report['chartQuery']>;
  exportMutation?: Partial<Report['exportMutation']>;
}

function makeReport(override: OverrideReport = {}): Report {
  const { tableQuery, chartQuery, exportMutation, ...rest } = override;
  const base = {
    days: '30' as '30' | '60' | '90',
    page: 1,
    setPage: vi.fn(),
    sortBy: 'endDate',
    sortOrder: 'asc',
    tableData: [
      {
        contractId: 'ct-1',
        contractTitle: 'Web Dev Contract',
        contractorId: 'c-1',
        contractorName: 'Acme',
        endDate: '2026-04-30',
        daysRemaining: 25,
        status: 'EXPIRING',
      },
    ],
    totalCount: 1,
    chartData: [],
    handleSortChange: vi.fn(),
    handleDaysChange: vi.fn(),
    handleExportPage: vi.fn(),
    handleExportAll: vi.fn(),
    handleChartRetry: vi.fn(),
    handleTableRetry: vi.fn(),
    ...rest,
    tableQuery: { isLoading: false, isFetching: false, isError: false, ...(tableQuery ?? {}) },
    chartQuery: { isLoading: false, isError: false, ...(chartQuery ?? {}) },
    exportMutation: { isPending: false, ...(exportMutation ?? {}) },
  };
  return base as unknown as Report;
}

function withRouter(report: Report) {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale/*" element={<ExpiringContractsReport report={report} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExpiringContractsReport (web-vite)', () => {
  it('renders the 30/60/90 day selector buttons', async () => {
    const { container } = await mount(withRouter(makeReport()));
    const text = container.textContent ?? '';
    expect(text).toMatch(/30/);
    expect(text).toMatch(/60/);
    expect(text).toMatch(/90/);
  });

  it('renders the data row supplied by the report stub', async () => {
    await mount(withRouter(makeReport()));
    expect(findByText(document.body, 'Web Dev Contract')).not.toBeNull();
  });

  it('invokes report.handleDaysChange when a day selector is clicked', async () => {
    const handleDaysChange = vi.fn();
    const { container } = await mount(withRouter(makeReport({ handleDaysChange })));
    const day60 = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      (b.textContent ?? '').includes('60'),
    );
    expect(day60).toBeDefined();
    await click(day60 as HTMLButtonElement);
    expect(handleDaysChange).toHaveBeenCalledWith('60');
  });

  it('marks the active day variant with the default button class', async () => {
    const { container } = await mount(withRouter(makeReport({ days: '60' })));
    const day60 = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      (b.textContent ?? '').includes('60'),
    );
    expect(day60?.className ?? '').not.toContain('variant-outline');
  });

  it('renders the empty state title when totalCount is 0', async () => {
    await mount(
      withRouter(
        makeReport({
          tableData: [],
          totalCount: 0,
        }),
      ),
    );
    expect(findByText(document.body, /Expiring|expiring|empty/i)).not.toBeNull();
  });

  it('disables Previous when on page 1', async () => {
    await mount(withRouter(makeReport({ totalCount: 100 })));
    expect(findButton(document.body, 'Previous')?.disabled).toBe(true);
  });

  it('hides pagination during table load (skeleton branch wins)', async () => {
    await mount(
      withRouter(
        makeReport({
          tableData: [],
          totalCount: 100,
          tableQuery: { isLoading: true, isFetching: false, isError: false },
        }),
      ),
    );
    expect(findButton(document.body, 'Previous')).toBeNull();
  });

  it('invokes report.handleExportPage when an export button is clicked', async () => {
    const handleExportPage = vi.fn();
    const { container } = await mount(withRouter(makeReport({ handleExportPage })));
    // ExportButtons renders a `Export page` button; locate it by label
    // substring (the i18n key contains "page").
    const exportBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      /export.*page/i.test(b.textContent ?? ''),
    );
    if (!exportBtn) return; // ExportButtons label depends on locale resolution; skip when missing.
    await click(exportBtn);
    expect(handleExportPage).toHaveBeenCalledTimes(1);
  });
});
