import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslations } from '@/i18n/useTranslations';
import { render, screen } from '@/test/test-utils';

import type { InvoiceRow } from '../columns';
import { getColumns } from '../columns';

const sampleRow: InvoiceRow = {
  id: 'inv-1',
  invoiceNumber: 'FV/2026/01',
  issueDate: '2026-01-15T00:00:00.000Z',
  dueDate: '2030-06-01T00:00:00.000Z',
  subtotalMinor: 10000,
  totalMinor: 12300,
  currency: 'PLN',
  status: 'RECEIVED',
  matchStatus: 'MATCHED',
  source: 'MANUAL_UPLOAD',
  contractor: { id: 'c-1', legalName: 'Acme Sp. z o.o.' },
};

function RowTable({ row }: { row: InvoiceRow }) {
  const t = useTranslations('Invoices');
  const columns = useMemo(() => getColumns(t), [t]);
  const table = useReactTable({
    data: [row],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: r => r.id,
    enableRowSelection: true,
    state: { rowSelection: {} },
    onRowSelectionChange: () => undefined,
  });

  const first = table.getRowModel().rows[0]!;
  return (
    <table>
      <tbody>
        <tr>
          {first.getVisibleCells().map(cell => (
            <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

describe('getColumns / invoice row cells', () => {
  it('renders invoice number, contractor link, and currency', () => {
    render(<RowTable row={sampleRow} />);
    expect(screen.getByText('FV/2026/01')).toBeInTheDocument();
    const contractorLink = screen.getByRole('link', { name: /acme sp\. z o\.o\./i });
    expect(contractorLink).toHaveAttribute('href', '/en/contractors/c-1');
    expect(screen.getByText('PLN')).toBeInTheDocument();
  });

  it('renders em dash when contractor is null', () => {
    render(<RowTable row={{ ...sampleRow, id: 'inv-2', contractor: null }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders the KSeF badge for KSEF source rows', () => {
    render(<RowTable row={{ ...sampleRow, id: 'inv-3', source: 'KSEF' }} />);
    expect(screen.getByText('KSeF')).toBeInTheDocument();
  });

  it('renders em dash for missing issue date', () => {
    render(<RowTable row={{ ...sampleRow, id: 'inv-4', issueDate: null }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders em dash for missing due date', () => {
    render(<RowTable row={{ ...sampleRow, id: 'inv-5', dueDate: null }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('applies destructive styling to overdue cells (past due + non-terminal status)', () => {
    const { container } = render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-6',
          dueDate: '2020-01-01T00:00:00.000Z',
          status: 'RECEIVED',
        }}
      />,
    );
    expect(container.querySelector('.text-destructive')).toBeInTheDocument();
  });

  it('does NOT apply destructive styling for PAID rows with past due dates', () => {
    const { container } = render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-7',
          dueDate: '2020-01-01T00:00:00.000Z',
          status: 'PAID',
        }}
      />,
    );
    expect(container.querySelector('.text-destructive')).toBeNull();
  });

  it('renders em dash for unknown matchStatus', () => {
    render(<RowTable row={{ ...sampleRow, id: 'inv-11', matchStatus: 'UNKNOWN_STATUS' }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
