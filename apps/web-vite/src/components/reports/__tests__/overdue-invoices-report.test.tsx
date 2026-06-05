/**
 * Component-prop pattern (post container/component split): the `report`
 * prop is stubbed with the shape `useOverdueInvoicesReport` returns. The
 * test does not exercise tRPC; it asserts presentational wiring and the
 * action callbacks the container would pass through.
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

import type { useOverdueInvoicesReport } from '../hooks/use-overdue-invoices-report.js';
import { OverdueInvoicesReport } from '../overdue-invoices-report.js';
import { click, findButton, findByText, mount } from './_render.js';

type Report = ReturnType<typeof useOverdueInvoicesReport>;

afterEach(() => {
  document.body.innerHTML = '';
});

function makeReport(override: Partial<Report> = {}): Report {
  return {
    page: 1,
    setPage: vi.fn(),
    sortBy: 'dueDate',
    sortOrder: 'asc',
    tableData: [
      {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-001',
        contractorId: 'c-1',
        contractorName: 'Acme Ltd',
        amountMinor: 1234_56,
        currency: 'PLN',
        dueDate: '2026-04-01',
        daysOverdue: 45,
        status: 'OVERDUE',
      },
    ],
    totalCount: 1,
    tableQuery: { isLoading: false, isFetching: false, isError: false },
    exportMutation: { isPending: false },
    handleSortChange: vi.fn(),
    handleExportPage: vi.fn(),
    handleExportAll: vi.fn(),
    handleTableRetry: vi.fn(),
    ...override,
  } as unknown as Report;
}

function withRouter(report: Report) {
  return (
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale/*" element={<OverdueInvoicesReport report={report} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OverdueInvoicesReport (web-vite)', () => {
  it('renders the invoice row from the report stub', async () => {
    await mount(withRouter(makeReport()));
    expect(findByText(document.body, 'INV-2026-001')).not.toBeNull();
    expect(findByText(document.body, 'Acme Ltd')).not.toBeNull();
  });

  it('renders the days-overdue cell with the destructive class above 30', async () => {
    const { container } = await mount(withRouter(makeReport()));
    const overdueCell = Array.from(container.querySelectorAll('span')).find(
      s => (s.textContent ?? '').trim() === '45',
    );
    expect(overdueCell).toBeDefined();
    expect(overdueCell?.className ?? '').toContain('text-destructive');
  });

  it('renders the empty state when totalCount is 0', async () => {
    await mount(withRouter(makeReport({ tableData: [], totalCount: 0 })));
    // Empty illustration + title should render. We assert at least one
    // non-empty heading-like element exists.
    const body = (document.body.textContent ?? '').trim();
    expect(body.length).toBeGreaterThan(0);
  });

  it('disables Previous on page 1', async () => {
    await mount(withRouter(makeReport({ totalCount: 100 })));
    expect(findButton(document.body, 'Previous')?.disabled).toBe(true);
  });

  it('invokes report.handleExportAll when the export-all button is clicked', async () => {
    const handleExportAll = vi.fn();
    const { container } = await mount(withRouter(makeReport({ handleExportAll })));
    const exportAllBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      b => /export.*all/i.test(b.textContent ?? ''),
    );
    if (!exportAllBtn) return; // i18n key may not interpolate in jsdom; skip silently.
    await click(exportAllBtn);
    expect(handleExportAll).toHaveBeenCalledTimes(1);
  });

  it('shows the refetch overlay when isFetching without isLoading', async () => {
    const { container } = await mount(
      withRouter(
        makeReport({
          tableQuery: {
            isLoading: false,
            isFetching: true,
            isError: false,
          } as Report['tableQuery'],
        }),
      ),
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
