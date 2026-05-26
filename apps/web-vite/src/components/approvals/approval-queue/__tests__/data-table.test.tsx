/**
 * Step 10 port of apps/web/src/components/approvals/approval-queue/__tests__/data-table.test.tsx.
 *
 * The web-vite ApprovalQueueTable is a pure presentational component — pagination,
 * row selection, and skeleton logic live inside, but data/columns/page/onClick
 * arrive as props. Tests inject minimal column defs and the legacy ApprovalQueueRow
 * shape so we exercise rendering + interaction without tRPC.
 */

import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { ApprovalQueueRow } from '../columns.js';
import { ApprovalQueueTable } from '../data-table.js';

function makeRow(id: string, status = 'PENDING'): ApprovalQueueRow {
  return {
    id,
    stepOrder: 1,
    name: 'Level 1',
    status,
    approverUserId: null,
    approverRole: null,
    slaDeadline: null,
    createdAt: '2026-01-01T00:00:00Z',
    approvalFlow: {
      id: 'f-1',
      resourceId: 'inv-1',
      resourceType: 'INVOICE',
      status: 'IN_PROGRESS',
      startedAt: '2026-01-01T00:00:00Z',
      chainConfigId: null,
    },
    approver: null,
    invoice: null,
    slaStatus: null,
  };
}

const simpleColumns: ColumnDef<ApprovalQueueRow>[] = [
  { id: 'id', accessorKey: 'id', header: 'ID' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
];

function defaultProps() {
  return {
    columns: simpleColumns,
    pageCount: 3,
    page: 1,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onRowClick: vi.fn(),
    onSelectionChange: vi.fn(),
  };
}

describe('ApprovalQueueTable (web-vite)', () => {
  it('renders table rows from data', () => {
    render(<ApprovalQueueTable {...defaultProps()} data={[makeRow('r1'), makeRow('r2')]} />);
    expect(screen.getByText('r1')).toBeInTheDocument();
    expect(screen.getByText('r2')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading', () => {
    const { container } = render(<ApprovalQueueTable {...defaultProps()} data={[]} isLoading />);
    // 8 skeleton rows per the component spec
    const skeletonRows = container.querySelectorAll('tr[class]');
    expect(skeletonRows.length).toBeGreaterThanOrEqual(8);
  });

  it('renders pagination controls', () => {
    render(
      <ApprovalQueueTable {...defaultProps()} data={[makeRow('r1')]} pageCount={3} page={2} />,
    );
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('calls onPageChange on next click', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueTable
        {...defaultProps()}
        data={[makeRow('r1')]}
        pageCount={3}
        page={1}
        onPageChange={onPageChange}
      />,
    );
    await user.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous on first page', () => {
    render(<ApprovalQueueTable {...defaultProps()} data={[makeRow('r1')]} page={1} />);
    expect(screen.getByText('Previous').closest('button')).toBeDisabled();
  });

  it('calls onRowClick when a row is clicked', async () => {
    const onRowClick = vi.fn();
    const row = makeRow('r1');
    const { user } = setup(
      <ApprovalQueueTable {...defaultProps()} data={[row]} onRowClick={onRowClick} />,
    );
    await user.click(screen.getByText('r1'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('highlights overdue rows', () => {
    const overdueRow = makeRow('r1');
    overdueRow.slaDeadline = '2020-01-01T00:00:00Z'; // past deadline
    const { container } = render(<ApprovalQueueTable {...defaultProps()} data={[overdueRow]} />);
    const row = container.querySelector('tr.group');
    expect(row?.className).toContain('bg-destructive');
  });
});
