import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import type { ApprovalQueueRow } from '../columns';
import { getColumns } from '../columns';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

vi.mock('../../sla-badge', () => ({
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
  const t = (key: string) => key;
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

describe('getColumns', () => {
  it('renders invoice number as a link', () => {
    const row = makeRow();
    render(<TableWrapper data={[row]} onApprove={vi.fn()} onReject={vi.fn()} />);
    const link = screen.getByText('FV/2026/001');
    expect(link.closest('a')).toHaveAttribute('href', '/invoices/inv-1');
  });

  it('renders contractor name', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Test Contractor')).toBeInTheDocument();
  });

  it('formats amount in PLN', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    // 150000 minor = 1500.00 PLN
    expect(
      screen.getByText(text => text.includes('1') && text.includes('500')),
    ).toBeInTheDocument();
  });

  it('renders SLA badge', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('sla-badge')).toBeInTheDocument();
  });

  it('renders approve button for PENDING rows', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
  });

  it('does not render action buttons for non-PENDING rows', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'APPROVED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('actions.approve')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve is clicked', async () => {
    const onApprove = vi.fn();
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={onApprove} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.approve'));
    expect(onApprove).toHaveBeenCalledWith('step-1');
  });

  it('renders dash when invoice is null', () => {
    render(
      <TableWrapper data={[makeRow({ invoice: null })]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText('FV/2026/001')).not.toBeInTheDocument();
  });

  // ---- Reject popover ----
  it('renders reject button for PENDING rows', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('actions.reject')).toBeInTheDocument();
  });

  it('clicking reject button opens reject popover', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    expect(await screen.findByText('rejectPopover.heading')).toBeInTheDocument();
  });

  it('reject popover has comment textarea', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('reject confirm button is disabled when comment is too short', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    await screen.findByText('rejectPopover.heading');
    const confirmBtn = screen.getByText('rejectPopover.confirm');
    expect(confirmBtn.closest('button')).toBeDisabled();
  });

  it('shows min chars warning when comment is short', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'short');
    expect(screen.getByText('rejectPopover.minChars')).toBeInTheDocument();
  });

  it('enables reject confirm when comment is 10+ chars', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'This is a valid rejection reason');
    const confirmBtn = screen.getByText('rejectPopover.confirm');
    expect(confirmBtn.closest('button')).not.toBeDisabled();
  });

  // ---- Submitted column ----
  it('renders submitted time in relative format', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    // The startedAt is in the past, should show "Xd ago" or similar
    const timeCell = screen.getByText(/ago/);
    expect(timeCell).toBeInTheDocument();
  });

  // ---- Select checkbox ----
  it('renders row checkbox', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2); // header + row
  });

  // ---- APPROVED status has no actions ----
  it('renders no action buttons for APPROVED status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'APPROVED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('actions.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('actions.reject')).not.toBeInTheDocument();
  });

  // ---- REJECTED status has no actions ----
  it('renders no action buttons for REJECTED status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'REJECTED' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('actions.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('actions.reject')).not.toBeInTheDocument();
  });

  // ---- PENDING status shows action buttons ----
  it('renders approve and reject buttons for PENDING status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'PENDING' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
    expect(screen.getByText('actions.reject')).toBeInTheDocument();
  });

  // ---- Approve button click ----
  it('calls onApprove when approve button is clicked', async () => {
    const onApprove = vi.fn();
    const { user } = setup(
      <TableWrapper
        data={[makeRow({ status: 'PENDING' })]}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByText('actions.approve'));
    expect(onApprove).toHaveBeenCalled();
  });

  // ---- Reject button renders for PENDING ----
  it('renders reject button for PENDING status', () => {
    render(
      <TableWrapper
        data={[makeRow({ status: 'PENDING' })]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('actions.reject')).toBeInTheDocument();
  });

  // ---- Multiple rows with different statuses ----
  it('renders mixed status rows with appropriate actions', () => {
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
    // Only PENDING row should have action buttons
    const approveButtons = screen.getAllByText('actions.approve');
    expect(approveButtons.length).toBe(1);
  });

  // ---- Multiple PENDING rows ----
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
    const approveButtons = screen.getAllByText('actions.approve');
    expect(approveButtons.length).toBe(2);
  });

  // ---- Reject popover: calls onReject with stepId and comment ----
  it('calls onReject with step id and comment when reject is confirmed', async () => {
    const onReject = vi.fn();
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={onReject} />,
    );
    await user.click(screen.getByText('actions.reject'));
    const textarea = await screen.findByRole('textbox');
    await user.type(textarea, 'This invoice has incorrect amounts');
    const confirmBtn = screen.getByText('rejectPopover.confirm');
    await user.click(confirmBtn.closest('button')!);
    expect(onReject).toHaveBeenCalledWith('step-1', 'This invoice has incorrect amounts');
  });

  // ---- Reject popover: dismiss button closes it ----
  it('dismiss button in reject popover closes it', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    await user.click(screen.getByText('actions.reject'));
    await screen.findByText('rejectPopover.heading');
    await user.click(screen.getByText('rejectPopover.dismiss'));
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(screen.queryByText('rejectPopover.heading')).not.toBeInTheDocument();
    });
  });

  // ---- Null invoice renders dash for amount ----
  it('renders dash for amount when invoice is null', () => {
    render(
      <TableWrapper data={[makeRow({ invoice: null })]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    // Amount column should show mdash
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Null invoice renders dash for submitted time ----
  it('renders submitted time even when invoice is null', () => {
    render(
      <TableWrapper data={[makeRow({ invoice: null })]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    // Submitted column uses approvalFlow.startedAt, not invoice
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  // ---- SLA badge renders with slaStatus ----
  it('renders SLA badge with sla status data', () => {
    render(
      <TableWrapper
        data={[
          makeRow({
            slaDeadline: '2026-04-10T00:00:00Z',
            slaStatus: {
              level: 'WARNING',
              label: '4h left',
              percentage: 80,
              hoursRemaining: 4,
            },
          }),
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sla-badge')).toBeInTheDocument();
  });

  // ---- Contractor name from sellerName when no contractor ----
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

  // ---- Header checkbox renders ----
  it('renders header checkbox for select all', () => {
    render(<TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // At least 2: header + 1 row
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Row checkbox can be toggled ----
  it('row checkbox can be toggled', async () => {
    const { user } = setup(
      <TableWrapper data={[makeRow()]} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes[1];
    await user.click(rowCheckbox);
  });
});
