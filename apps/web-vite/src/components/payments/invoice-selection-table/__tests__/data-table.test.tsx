/**
 * Ported from apps/web/src/components/payments/invoice-selection-table/__tests__/data-table.test.tsx.
 *
 * Uses the local echo translator (web-vite has no `createMockTranslator`
 * lift). Asserts the loading/data/disabled-checkbox rendering paths.
 */

import { render, screen } from '@/test/test-utils';

import type { LooseTranslator } from '../../../../i18n/typed-keys.js';
import type { ReadyInvoiceRow } from '../columns';
import { getColumns } from '../columns';
import { InvoiceSelectionDataTable } from '../data-table';

const t: LooseTranslator = (key: unknown) => String(key);

function makeRow(overrides: Partial<ReadyInvoiceRow> = {}): ReadyInvoiceRow {
  return {
    id: 'inv-1',
    invoiceNumber: 'FV/2026/001',
    totalMinor: 100000,
    amountToPayMinor: 100000,
    currency: 'PLN',
    dueDate: '2026-04-15',
    paymentStatus: 'READY',
    contractor: { id: 'c-1', legalName: 'Acme Corp', taxId: '123' },
    billingProfile: { id: 'bp-1', bankAccountMasked: '****1234', preferredCurrency: 'PLN' },
    contract: { id: 'ct-1', contractNumber: 'CTR-001' },
    ...overrides,
  };
}

describe('InvoiceSelectionDataTable', () => {
  const columns = getColumns(t);

  it('renders skeleton rows when loading', () => {
    render(
      <InvoiceSelectionDataTable
        data={[]}
        columns={columns}
        isLoading
        rowSelection={{}}
        onRowSelectionChange={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(7); // header + 6 skeleton rows
  });

  it('renders data rows when not loading', () => {
    const data = [makeRow(), makeRow({ id: 'inv-2', invoiceNumber: 'FV/2026/002' })];
    render(
      <InvoiceSelectionDataTable
        data={data}
        columns={columns}
        isLoading={false}
        rowSelection={{}}
        onRowSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText('FV/2026/001')).toBeInTheDocument();
    expect(screen.getByText('FV/2026/002')).toBeInTheDocument();
  });

  it('disables checkbox for rows already attached to a run', () => {
    const data = [makeRow({ _inRunNumber: 'PR-2026-001' })];
    render(
      <InvoiceSelectionDataTable
        data={data}
        columns={columns}
        isLoading={false}
        rowSelection={{}}
        onRowSelectionChange={vi.fn()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes.find(
      cb => cb.getAttribute('aria-disabled') === 'true' || cb.hasAttribute('disabled'),
    );
    expect(rowCheckbox).toBeDefined();
  });
});
