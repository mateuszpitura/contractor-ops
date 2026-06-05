/**
 * getColumns is a pure factory — we render the columns through a vanilla
 * TanStack table wrapper to exercise cell/header logic. SlaBadge is
 * stubbed to keep this focused on the column definitions; SLA logic has its own
 * test. i18n key assertions use the live EN strings from the Approvals
 * namespace.
 */

import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { render, screen, setup } from '../../../../test/test-utils.js';
import type { ApprovalQueueRow } from '../columns.js';
import { getColumns } from '../columns.js';

vi.mock('../../sla-badge.js', () => ({
  SlaBadge: ({ slaDeadline, status }: { slaDeadline: string | null; status: string }) => (
    <span data-testid="sla-badge">
      {status}-{slaDeadline ?? 'none'}
    </span>
  ),
}));

function makeRow(overrides: Partial<ApprovalQueueRow> = {}): ApprovalQueueRow {
  return {
    id: 'step-1',
    stepOrder: 1,
    name: 'Manager Approval',
    status: 'PENDING',
    approverUserId: 'user-1',
    approverRole: 'team_manager',
    slaDeadline: null,
    createdAt: '2026-01-01T00:00:00Z',
    approvalFlow: {
      id: 'flow-1',
      resourceId: 'inv-1',
      resourceType: 'INVOICE',
      status: 'IN_PROGRESS',
      startedAt: '2026-01-01T00:00:00Z',
      chainConfigId: null,
    },
    approver: {
      id: 'user-1',
      name: 'Jan Kowalski',
      email: 'jan@example.com',
      image: null,
    },
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'FV/2026/001',
      sellerName: 'Test Seller',
      totalMinor: 150000,
      currency: 'PLN',
      createdAt: '2026-01-01T00:00:00Z',
      contractor: { id: 'c-1', legalName: 'Test Contractor' },
    },
    slaStatus: null,
    ...overrides,
  };
}

function TableWrapper({
  data,
  onApprove,
  onReject,
}: {
  data: ApprovalQueueRow[];
  onApprove: (id: string) => void;
  onReject: (id: string, comment: string) => void;
}) {
  const t = useTranslations('Approvals');
  const columns = getColumns(t, { onApprove, onReject });
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.id,
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id}>
            {hg.headers.map(h => (
              <th key={h.id}>
                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('getColumns (web-vite)', () => {
  it('renders invoice number as a link', () => {
    const row = makeRow();
    render(<TableWrapper data={[row]} onApprove={vi.fn()} onReject={vi.fn()} />);
    const link = screen.getByText('FV/2026/001');
    // Link prefixes the locale segment from MemoryRouter.
    expect(link.closest('a')).toHaveAttribute('href', '/en/invoices/inv-1');
  });

  it('renders contractor name', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Test Contractor')).toBeInTheDocument();
  });

  it('formats amount with the currency token', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    // formatMinorUnits renders "1,500.00 PLN" / "1 500,00 PLN" depending on locale.
    expect(
      screen.getByText(text => text.includes('1') && text.includes('500') && text.includes('PLN')),
    ).toBeInTheDocument();
  });

  it('renders SLA badge', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('sla-badge')).toBeInTheDocument();
  });

  it('renders approve button for PENDING rows', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('does not render action buttons for non-PENDING rows', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'APPROVED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve is clicked', async () => {
    const onApprove = vi.fn();
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={onApprove} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith('step-1');
  });

  it('renders mdash when invoice is null', () => {
    const { container } = render(
      <TableWrapper data={[makeRow({ invoice: null })]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText('FV/2026/001')).not.toBeInTheDocument();
    expect(container.textContent).toContain('—');
  });

  it('renders reject button for PENDING rows', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('clicking reject button opens reject popover', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Reject'));
    // Popover renders heading <h4>Reject invoice</h4> + confirm <button>Reject invoice</button>.
    await screen.findByRole('textbox');
    expect(screen.getAllByText('Reject invoice').length).toBeGreaterThanOrEqual(1);
  });

  it('reject popover has comment textarea', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Reject'));
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('reject confirm button is disabled when comment is too short', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Reject'));
    const confirmBtn = (await screen.findAllByText('Reject invoice')).at(-1);
    expect(confirmBtn?.closest('button')).toBeDisabled();
  });

  it('shows min chars warning when comment is short', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'short');
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('enables reject confirm when comment is 10+ chars', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('Reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'This is a valid rejection reason');
    const confirmBtn = (await screen.findAllByText('Reject invoice')).at(-1);
    expect(confirmBtn?.closest('button')).not.toBeDisabled();
  });

  it('renders submitted time in relative format', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('renders row checkbox plus header checkbox', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders no action buttons for APPROVED status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'APPROVED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('renders no action buttons for REJECTED status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'REJECTED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('renders mixed status rows with only PENDING row showing actions', () => {
    render(
      <TableWrapper
        data={[
          makeRow({ id: 'a-1', status: 'PENDING' }),
          makeRow({ id: 'a-2', status: 'APPROVED' }),
          makeRow({ id: 'a-3', status: 'REJECTED' }),
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    const approveButtons = screen.getAllByText('Approve');
    expect(approveButtons.length).toBe(1);
  });

  it('renders approve buttons for multiple PENDING rows', () => {
    render(
      <TableWrapper
        data={[
          makeRow({ id: 'a-1', status: 'PENDING' }),
          makeRow({ id: 'a-2', status: 'PENDING' }),
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Approve').length).toBe(2);
  });

  it('calls onReject with step id and comment when reject is confirmed', async () => {
    const onReject = vi.fn();
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={onReject} />,
    );
    await user.click(screen.getByText('Reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'This invoice has incorrect amounts');
    const confirmBtn = (await screen.findAllByText('Reject invoice')).at(-1);
    await user.click(confirmBtn?.closest('button') as HTMLButtonElement);
    expect(onReject).toHaveBeenCalledWith('step-1', 'This invoice has incorrect amounts');
  });

  it('renders seller name when contractor is null on invoice', () => {
    render(
      <TableWrapper
        data={[
          makeRow({
            invoice: {
              id: 'inv-2',
              invoiceNumber: 'FV/2026/002',
              sellerName: 'Some Seller',
              totalMinor: 100000,
              currency: 'PLN',
              createdAt: '2026-02-01T00:00:00Z',
              contractor: null,
            },
          }),
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('Some Seller')).toBeInTheDocument();
  });
});
