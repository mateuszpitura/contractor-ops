/**
 * Ported from apps/web/src/components/payments/payment-run-table/__tests__/data-table.test.tsx.
 *
 * Uses an echo translator. Mocks PaymentRunBadge so the status cell stays
 * inert. The table reads `Payments` translations internally via
 * `useTranslations`, which the harness provides; we still need the
 * columns to render shape, so we pass the echo translator into
 * `getColumns`.
 */

vi.mock('../../payment-run-badge', () => ({
  PaymentRunBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { render, screen, setup } from '@/test/test-utils';

import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import type { PaymentRunRow } from '../columns';
import { getColumns } from '../columns';
import { PaymentRunDataTable } from '../data-table';

const t: LooseTranslator = (key: unknown) => String(key);

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
  const columns = getColumns(t, {});

  it('renders skeleton rows when loading', () => {
    render(
      <PaymentRunDataTable
        data={[]}
        columns={columns}
        isLoading
        hasNextPage={false}
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole('row');
    // header + 8 skeleton rows
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

  it('invokes onRowClick when a row is clicked', async () => {
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

  it('shows pagination buttons when next or previous page exists', () => {
    render(
      <PaymentRunDataTable
        data={[makeRow()]}
        columns={columns}
        isLoading={false}
        hasNextPage
        hasPreviousPage={false}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onRowClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('hides pagination buttons when neither next nor previous exist', () => {
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
