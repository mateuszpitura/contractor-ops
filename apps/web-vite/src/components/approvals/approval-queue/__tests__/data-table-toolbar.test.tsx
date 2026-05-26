/**
 * Step 10 port of apps/web/src/components/approvals/approval-queue/__tests__/data-table-toolbar.test.tsx.
 *
 * Web-vite ApprovalQueueToolbar receives `bulkActions` (hook return) as a prop —
 * the legacy `vi.mock('@tanstack/react-query')` + `vi.mock('@/trpc/init')` plumbing
 * goes away. Assertions target real EN translations from the live i18n bundle.
 */

import { describe, expect, it, vi } from 'vitest';

import { screen, setup } from '../../../../test/test-utils.js';
import { ApprovalQueueToolbar } from '../data-table-toolbar.js';

type BulkActions = React.ComponentProps<typeof ApprovalQueueToolbar>['bulkActions'];

function makeBulkActions(overrides: Partial<BulkActions> = {}): BulkActions {
  return {
    onBulkApprove: vi.fn(),
    onBulkReject: vi.fn(),
    isBulkApproving: false,
    isBulkRejecting: false,
    ...overrides,
  } as BulkActions;
}

function defaultProps() {
  return {
    activeStatuses: [] as string[],
    onStatusChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    selectedIds: [] as string[],
    onClearSelection: vi.fn(),
    bulkActions: makeBulkActions(),
  };
}

describe('ApprovalQueueToolbar (web-vite)', () => {
  it('renders the status filter button', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    // The filter trigger uses the `columns.status` translation ("Status").
    const buttons = screen.getAllByRole('button', { name: /status/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders search input with placeholder', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    expect(screen.getByPlaceholderText('Search approvals...')).toBeInTheDocument();
  });

  it('does not show bulk toolbar when no items selected', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    expect(screen.queryByText(/selected$/i)).not.toBeInTheDocument();
  });

  it('shows bulk toolbar when items are selected', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} selectedIds={['a', 'b']} />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Approve (2)')).toBeInTheDocument();
    expect(screen.getByText('Reject (2)')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button is clicked', async () => {
    const onClearSelection = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar
        {...defaultProps()}
        selectedIds={['a']}
        onClearSelection={onClearSelection}
      />,
    );
    await user.click(screen.getByText('Clear'));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('updates local search on input', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps()} />);
    const input = screen.getByPlaceholderText('Search approvals...');
    await user.type(input, 'abc');
    expect(input).toHaveValue('abc');
  });

  it('renders search input with initial value', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} search="existing query" />);
    expect(screen.getByPlaceholderText('Search approvals...')).toHaveValue('existing query');
  });

  it('shows correct count for 5 selected items', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} selectedIds={['a', 'b', 'c', 'd', 'e']} />);
    expect(screen.getByText('5 selected')).toBeInTheDocument();
    expect(screen.getByText('Approve (5)')).toBeInTheDocument();
    expect(screen.getByText('Reject (5)')).toBeInTheDocument();
  });

  it('opens reject dialog when reject button is clicked', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps()} selectedIds={['a', 'b']} />);
    await user.click(screen.getByText('Reject (2)'));
    // Heading is rendered with the count label; both the title and the destructive
    // confirm button match — assert >=1 occurrence.
    expect(screen.getAllByText('Reject 2 invoices').length).toBeGreaterThanOrEqual(1);
  });

  it('renders comment textarea in reject dialog', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps()} selectedIds={['a']} />);
    await user.click(screen.getByText('Reject (1)'));
    expect(
      screen.getByPlaceholderText('This reason will be applied to all selected invoices...'),
    ).toBeInTheDocument();
  });

  it('invokes bulk approve when the approve button is clicked', async () => {
    const onBulkApprove = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar
        {...defaultProps()}
        selectedIds={['a', 'b']}
        bulkActions={makeBulkActions({ onBulkApprove })}
      />,
    );
    await user.click(screen.getByText('Approve (2)'));
    expect(onBulkApprove).toHaveBeenCalledWith(['a', 'b']);
  });
});
