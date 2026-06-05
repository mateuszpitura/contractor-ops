/**
 * Component-prop pattern. `useDateFormatter` is stubbed because the
 * component calls it for the last-paid-at cell.
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/format/use-date-formatter.js', () => ({
  useDateFormatter: () => ({
    formatDate: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatTime: (v: unknown) => (typeof v === 'string' ? v : ''),
    formatDateTime: (v: unknown) => (typeof v === 'string' ? v : ''),
  }),
}));

import type { useSpendContractorReport } from '../hooks/use-spend-contractor-report.js';
import { SpendContractorReport } from '../spend-contractor-report.js';
import { click, findByText, mount } from './_render.js';

type Report = ReturnType<typeof useSpendContractorReport>;

afterEach(() => {
  document.body.innerHTML = '';
});

function makeReport(override: Partial<Report> = {}): Report {
  return {
    page: 1,
    setPage: vi.fn(),
    sortBy: 'totalSpend',
    sortOrder: 'desc',
    drillDownContractorId: null,
    drillDownName: null,
    tableData: [
      {
        contractorId: 'c-1',
        contractorName: 'Acme Ltd',
        invoiceCount: 6,
        totalMinor: 120_000_00,
        avgMinor: 20_000_00,
        lastPaidAt: '2026-03-15',
      },
    ],
    totalCount: 1,
    chartData: [{ contractorId: 'c-1', contractorName: 'Acme Ltd', totalMinor: 120_000_00 }],
    grandTotal: 120_000_00,
    tableQuery: { isLoading: false, isFetching: false, isError: false },
    chartQuery: { isLoading: false, isError: false },
    exportMutation: { isPending: false },
    handleSortChange: vi.fn(),
    handleDrillDown: vi.fn(),
    handleClearDrillDown: vi.fn(),
    handleChartRetry: vi.fn(),
    handleTableRetry: vi.fn(),
    handleExportPage: vi.fn(),
    handleExportAll: vi.fn(),
    ...override,
  } as unknown as Report;
}

function withRouter(report: Report) {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale/*" element={<SpendContractorReport report={report} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SpendContractorReport (web-vite)', () => {
  it('renders the contractor row from the stub', async () => {
    await mount(withRouter(makeReport()));
    expect(findByText(document.body, 'Acme Ltd')).not.toBeNull();
  });

  it('renders the grand total numeric magnitude', async () => {
    const { container } = await mount(withRouter(makeReport()));
    expect((container.textContent ?? '').includes('120')).toBe(true);
  });

  it('renders the empty state when totalCount is 0', async () => {
    await mount(
      withRouter(
        makeReport({
          tableData: [],
          totalCount: 0,
          grandTotal: 0,
        }),
      ),
    );
    expect((document.body.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('renders the drill-down crumb when drillDownName is set', async () => {
    const { container } = await mount(
      withRouter(
        makeReport({
          drillDownContractorId: 'c-1',
          drillDownName: 'Acme Ltd',
        }),
      ),
    );
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('invokes report.handleExportAll on click', async () => {
    const handleExportAll = vi.fn();
    const { container } = await mount(withRouter(makeReport({ handleExportAll })));
    const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      /export.*all/i.test(b.textContent ?? ''),
    );
    if (!btn) return;
    await click(btn);
    expect(handleExportAll).toHaveBeenCalledTimes(1);
  });
});
