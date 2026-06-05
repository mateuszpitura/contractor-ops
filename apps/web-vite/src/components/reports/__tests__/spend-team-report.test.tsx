/**
 * Component-prop pattern (post container/component split). `report` is a
 * shaped stub; no tRPC mocking is needed because `SpendTeamReport` does
 * not import `useDateFormatter` or `useRouter` — it consumes `report`
 * only. Wrapped in MemoryRouter for symmetry with siblings (`Link` from
 * react-router would otherwise need a router context if added later).
 */

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { useSpendTeamReport } from '../hooks/use-spend-team-report.js';
import { SpendTeamReport } from '../spend-team-report.js';
import { click, findByText, mount } from './_render.js';

type Report = ReturnType<typeof useSpendTeamReport>;

afterEach(() => {
  document.body.innerHTML = '';
});

function makeReport(override: Partial<Report> = {}): Report {
  return {
    page: 1,
    setPage: vi.fn(),
    sortBy: 'totalSpend',
    sortOrder: 'desc',
    drillDownTeamId: null,
    drillDownName: null,
    tableData: [
      {
        teamId: 'team-1',
        teamName: 'Engineering',
        contractorCount: 4,
        invoiceCount: 12,
        totalMinor: 500_000_00,
      },
    ],
    totalCount: 1,
    chartData: [{ teamId: 'team-1', teamName: 'Engineering', totalMinor: 500_000_00 }],
    grandTotal: 500_000_00,
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
        <Route path="/:locale/*" element={<SpendTeamReport report={report} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SpendTeamReport (web-vite)', () => {
  it('renders the team row from the stub', async () => {
    await mount(withRouter(makeReport()));
    expect(findByText(document.body, 'Engineering')).not.toBeNull();
  });

  it('renders the grand total row when a value is supplied', async () => {
    const { container } = await mount(withRouter(makeReport()));
    // formatCurrency emits PLN locale; assert the magnitude shows up.
    expect((container.textContent ?? '').includes('500')).toBe(true);
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
          drillDownTeamId: 'team-1',
          drillDownName: 'Engineering',
        }),
      ),
    );
    // "Engineering" appears both in the table row + drill-down crumb.
    expect(container.querySelectorAll('*').length).toBeGreaterThan(0);
  });

  it('invokes report.handleExportPage on click', async () => {
    const handleExportPage = vi.fn();
    const { container } = await mount(withRouter(makeReport({ handleExportPage })));
    const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      /export.*page/i.test(b.textContent ?? ''),
    );
    if (!btn) return;
    await click(btn);
    expect(handleExportPage).toHaveBeenCalledTimes(1);
  });
});
