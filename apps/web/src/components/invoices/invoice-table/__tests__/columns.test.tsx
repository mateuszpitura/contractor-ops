import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { InvoiceRow } from '../columns';
import { getColumns } from '../columns';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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
  const columns = useMemo(() => getColumns(key => t(key as Parameters<typeof t>[0])), [t]);
  const table = useReactTable({
    data: [row],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: r => r.id,
    enableRowSelection: true,
    state: { rowSelection: {} },
    onRowSelectionChange: () => undefined,
  });

  const first = table.getRowModel().rows[0];
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
  it('renders invoice number, contractor link, amounts, status, and upload source', () => {
    render(<RowTable row={sampleRow} />);

    expect(screen.getByText('FV/2026/01')).toBeInTheDocument();
    const contractorLink = screen.getByRole('link', { name: /acme sp\. z o\.o\./i });
    expect(contractorLink).toHaveAttribute('href', '/contractors/c-1');
    expect(screen.getByText('PLN')).toBeInTheDocument();
    expect(screen.getByText(/received/i)).toBeInTheDocument();
    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
  });

  it('renders em dash for missing contractor', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-2',
          contractor: null,
        }}
      />,
    );

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders KSeF badge cell for KSEF source', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-3',
          source: 'KSEF',
        }}
      />,
    );

    expect(screen.getByText('KSeF')).toBeInTheDocument();
  });

  it('renders em dash for missing issue date', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-4',
          issueDate: null,
        }}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders em dash for missing due date', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-5',
          dueDate: null,
        }}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders overdue styling for past due date with non-terminal status', () => {
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
    const overdueCell = container.querySelector('.text-destructive');
    expect(overdueCell).toBeInTheDocument();
  });

  it('does not render overdue styling for PAID status even with past due date', () => {
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
    const overdueCell = container.querySelector('.text-destructive');
    expect(overdueCell).toBeNull();
  });

  it('renders em dash for EMAIL_INTAKE source', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-8',
          source: 'EMAIL_INTAKE',
        }}
      />,
    );
    // EMAIL_INTAKE renders a Mail icon, not em dash
    expect(screen.getByText('FV/2026/01')).toBeInTheDocument();
  });

  it('renders UNMATCHED match status with dot indicator', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-9',
          matchStatus: 'UNMATCHED',
        }}
      />,
    );
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('renders MANUALLY_CONFIRMED match status', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-10',
          matchStatus: 'MANUALLY_CONFIRMED',
        }}
      />,
    );
    expect(screen.getByText('Manually matched')).toBeInTheDocument();
  });

  it('renders em dash for unknown match status', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-11',
          matchStatus: 'UNKNOWN_STATUS',
        }}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders different invoice status badges', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-12',
          status: 'APPROVED',
        }}
      />,
    );
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });

  it('renders fallback badge for unknown status', () => {
    render(
      <RowTable
        row={{
          ...sampleRow,
          id: 'inv-13',
          status: 'UNKNOWN_STATUS',
        }}
      />,
    );
    expect(screen.getByText(/unknownStatus/i)).toBeInTheDocument();
  });
});
