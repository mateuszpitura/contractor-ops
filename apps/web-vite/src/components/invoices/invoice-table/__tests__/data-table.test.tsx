import { render, screen, setup } from '@/test/test-utils';
import type { useInvoiceList } from '../../hooks/use-invoice-list';
import type { InvoiceRow } from '../columns';
import { InvoiceDataTable } from '../data-table';

type TableProps = ReturnType<typeof useInvoiceList>['tableProps'];

function baseRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: 'inv-dt-1',
    invoiceNumber: 'FV/DATA/01',
    issueDate: '2026-01-15T00:00:00.000Z',
    dueDate: '2030-06-01T00:00:00.000Z',
    subtotalMinor: 10000,
    totalMinor: 12300,
    currency: 'PLN',
    status: 'RECEIVED',
    matchStatus: 'MATCHED',
    source: 'MANUAL_UPLOAD',
    contractor: { id: 'c-1', legalName: 'Acme Sp. z o.o.' },
    ...overrides,
  };
}

function baseProps(overrides: Partial<TableProps> = {}): TableProps {
  return {
    data: [],
    totalRows: 0,
    filters: {
      search: '',
      page: 1,
      pageSize: 10,
      sortBy: 'receivedAt',
      sortOrder: 'desc',
      status: [],
      matchStatus: [],
      source: [],
      contractorId: '',
    },
    onFiltersChange: vi.fn(),
    onSearchChange: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSortChange: vi.fn(),
    clearFilters: vi.fn(),
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    ...overrides,
  } as TableProps;
}

describe('InvoiceDataTable', () => {
  it('shows skeleton rows while loading without data', () => {
    const { container } = render(
      <InvoiceDataTable
        {...baseProps({ isLoading: true })}
        onRowClick={vi.fn()}
        onUpload={vi.fn()}
        toolbar={<div />}
      />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders an invoice row and calls onRowClick with the row payload', async () => {
    const row = baseRow();
    const onRowClick = vi.fn();
    const { user } = setup(
      <InvoiceDataTable
        {...baseProps({ data: [row], totalRows: 1 })}
        onRowClick={onRowClick}
        onUpload={vi.fn()}
        toolbar={<div />}
      />,
    );
    expect(screen.getByText('FV/DATA/01')).toBeInTheDocument();
    const tr = screen.getByText('FV/DATA/01').closest('tr')!;
    await user.click(tr);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv-dt-1' }));
  });

  it('renders an empty state heading with onUpload CTA when no rows and no filters', async () => {
    const onUpload = vi.fn();
    const { user } = setup(
      <InvoiceDataTable
        {...baseProps({ data: [], totalRows: 0 })}
        onRowClick={vi.fn()}
        onUpload={onUpload}
        toolbar={<div />}
      />,
    );
    expect(screen.getByRole('heading', { name: /no invoices yet/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /upload invoices/i }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('renders the filtered empty state when no rows + hasFiltersOrSearch is true', () => {
    render(
      <InvoiceDataTable
        {...baseProps({
          data: [],
          totalRows: 0,
          hasFiltersOrSearch: true,
          activeFilterCount: 1,
        })}
        onRowClick={vi.fn()}
        onUpload={vi.fn()}
        toolbar={<div />}
      />,
    );
    expect(screen.getByRole('heading', { name: /no invoices found/i })).toBeInTheDocument();
  });

  it('applies overdue styling to the due-date cell only, not the row container', () => {
    render(
      <InvoiceDataTable
        {...baseProps({
          data: [baseRow({ dueDate: '2020-01-01T00:00:00.000Z', status: 'RECEIVED' })],
          totalRows: 1,
        })}
        onRowClick={vi.fn()}
        onUpload={vi.fn()}
        toolbar={<div />}
      />,
    );
    const row = screen.getByText('FV/DATA/01').closest('tr')!;
    expect(row.className ?? '').not.toMatch(/destructive/);
    // Destructive styling lands on a wrapping span (sibling to the date text).
    const overdueText = screen
      .getAllByText(/2020/)
      .find(el => el.closest('.text-destructive') !== null);
    expect(overdueText).toBeDefined();
  });
});
