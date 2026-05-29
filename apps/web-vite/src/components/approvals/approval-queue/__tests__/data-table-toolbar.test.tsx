/**
 * ApprovalQueueToolbar (web-vite) — pure search + status filter toolbar.
 * Bulk selection bar moved out to ApprovalBulkActions (canonical contractors
 * pattern). Bulk-bar assertions live in data-table-bulk-actions.test.tsx.
 */

import { describe, expect, it, vi } from 'vitest';

import { screen, setup } from '../../../../test/test-utils.js';
import { ApprovalQueueToolbar } from '../data-table-toolbar.js';

function defaultProps() {
  return {
    activeStatuses: [] as string[],
    onStatusChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
  };
}

describe('ApprovalQueueToolbar (web-vite)', () => {
  it('renders the status filter button', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    const buttons = screen.getAllByRole('button', { name: /status/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders search input with placeholder', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    expect(screen.getByPlaceholderText('Search approvals...')).toBeInTheDocument();
  });

  it('does not render any bulk-action buttons', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} />);
    expect(screen.queryByText(/^Approve \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reject \(/)).not.toBeInTheDocument();
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

  it('shows active filter badges when statuses are applied', () => {
    setup(<ApprovalQueueToolbar {...defaultProps()} activeStatuses={['PENDING']} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });
});
