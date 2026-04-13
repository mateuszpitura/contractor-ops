import { render, screen, setup } from '@/test/test-utils';
import type { PaymentRunRow } from '../columns';
import { getColumns } from '../columns';
import { PaymentRunDataTable } from '../data-table';

vi.mock('../payment-run-badge', () => ({
  PaymentRunBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

function makeRow(overrides: Partial<PaymentRunRow> = {}): PaymentRunRow {
  return {
    id: 'run-1',
    runNumber: 'PR-2026-001',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    invoiceCount: 3,
    totalMinor: 300000,
    currency: 'PLN',
    exportFormat: null,
    exportedAt: null,
    ...overrides,
  };
}

describe('PaymentRunDataTable', () => {
  const t = (key: string) => key;
  const columns = getColumns(t, {});

  it('renders skeleton rows when loading', () => {
    render(
      <PaymentRunDataTable
        data={[]}
        columns={columns}
        isLoading={true}
        hasNextPage={false}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    // Header row + 8 skeleton rows
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(9);
  });

  it('renders data rows when not loading', () => {
    render(
      <PaymentRunDataTable
        data={[makeRow()]}
        columns={columns}
        isLoading={false}
        hasNextPage={false}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    expect(screen.getByText('PR-2026-001')).toBeInTheDocument();
  });

  it('calls onRowClick when a row is clicked', async () => {
    const onRowClick = vi.fn();
    const row = makeRow();
    const { user } = setup(
      <PaymentRunDataTable
        data={[row]}
        columns={columns}
        isLoading={false}
        hasNextPage={false}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText('PR-2026-001'));
    expect(onRowClick).toHaveBeenCalledWith(row);
  });

  it('shows pagination when hasNextPage or hasPreviousPage', () => {
    render(
      <PaymentRunDataTable
        data={[makeRow()]}
        columns={columns}
        isLoading={false}
        hasNextPage={true}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('hides pagination when no pages', () => {
    render(
      <PaymentRunDataTable
        data={[makeRow()]}
        columns={columns}
        isLoading={false}
        hasNextPage={false}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });
});
