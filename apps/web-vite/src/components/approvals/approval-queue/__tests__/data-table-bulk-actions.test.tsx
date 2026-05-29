/**
 * ApprovalBulkActions — inline bar between toolbar and table shell.
 * Mirrors the canonical contractors `DataTableBulkActions` shape.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import { ApprovalBulkActions } from '../data-table-bulk-actions.js';

type BulkActions = React.ComponentProps<typeof ApprovalBulkActions>['bulkActions'];

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
    selectedIds: ['a', 'b'],
    onClearSelection: vi.fn(),
    bulkActions: makeBulkActions(),
  };
}

describe('ApprovalBulkActions', () => {
  it('returns nothing when no rows are selected', () => {
    const { container } = render(<ApprovalBulkActions {...defaultProps()} selectedIds={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the inline bar with selection count + canonical buttons', () => {
    render(<ApprovalBulkActions {...defaultProps()} />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Approve (2)')).toBeInTheDocument();
    expect(screen.getByText('Reject (2)')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('wraps the actions in a rounded, bordered, muted container (canonical shape)', () => {
    const { container } = render(<ApprovalBulkActions {...defaultProps()} />);
    const bar = container.querySelector('.rounded-lg.border.bg-muted\\/50');
    expect(bar).toBeInTheDocument();
  });

  it('invokes onBulkApprove with the selected ids on Approve click', async () => {
    const onBulkApprove = vi.fn();
    const { user } = setup(
      <ApprovalBulkActions {...defaultProps()} bulkActions={makeBulkActions({ onBulkApprove })} />,
    );
    await user.click(screen.getByText('Approve (2)'));
    expect(onBulkApprove).toHaveBeenCalledWith(['a', 'b']);
  });

  it('opens the reject dialog when Reject is clicked', async () => {
    const { user } = setup(<ApprovalBulkActions {...defaultProps()} />);
    await user.click(screen.getByText('Reject (2)'));
    expect(screen.getAllByText('Reject 2 invoices').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByPlaceholderText('This reason will be applied to all selected invoices...'),
    ).toBeInTheDocument();
  });

  it('submits a valid rejection comment to onBulkReject', async () => {
    const onBulkReject = vi.fn();
    const { user } = setup(
      <ApprovalBulkActions {...defaultProps()} bulkActions={makeBulkActions({ onBulkReject })} />,
    );
    await user.click(screen.getByText('Reject (2)'));
    const textarea = screen.getByPlaceholderText(
      'This reason will be applied to all selected invoices...',
    );
    await user.type(textarea, 'duplicate invoice');
    const confirmButtons = screen.getAllByText('Reject 2 invoices');
    const confirmBtn = confirmButtons.find(el => el.closest('button'));
    if (confirmBtn) await user.click(confirmBtn);
    expect(onBulkReject).toHaveBeenCalledWith(['a', 'b'], 'duplicate invoice');
  });

  it('blocks reject confirmation when comment is under 10 chars', async () => {
    const onBulkReject = vi.fn();
    const { user } = setup(
      <ApprovalBulkActions {...defaultProps()} bulkActions={makeBulkActions({ onBulkReject })} />,
    );
    await user.click(screen.getByText('Reject (2)'));
    const textarea = screen.getByPlaceholderText(
      'This reason will be applied to all selected invoices...',
    );
    await user.type(textarea, 'short');
    const confirmButtons = screen.getAllByText('Reject 2 invoices');
    const confirmBtn = confirmButtons.find(el => el.closest('button'));
    if (confirmBtn) await user.click(confirmBtn);
    expect(onBulkReject).not.toHaveBeenCalled();
  });

  it('fires onClearSelection when Clear is clicked', async () => {
    const onClearSelection = vi.fn();
    const { user } = setup(
      <ApprovalBulkActions {...defaultProps()} onClearSelection={onClearSelection} />,
    );
    await user.click(screen.getByText('Clear'));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('marks the Reject button as destructive', () => {
    render(<ApprovalBulkActions {...defaultProps()} />);
    const rejectBtn = screen.getByText('Reject (2)').closest('button');
    expect(rejectBtn?.className).toContain('text-destructive');
  });
});
