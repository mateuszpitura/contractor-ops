import { describe, expect, it, vi } from 'vitest';
import { screen, setup } from '@/test/test-utils';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: any) => {
      if (params?.count) return `${key}(${params.count})`;
      return key;
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: (_opts: any) => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    approval: {
      bulkApprove: { mutationOptions: (opts: any) => opts },
      bulkReject: { mutationOptions: (opts: any) => opts },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ApprovalQueueToolbar } from '../data-table-toolbar';

const defaultProps = {
  activeStatus: 'all',
  onStatusChange: vi.fn(),
  search: '',
  onSearchChange: vi.fn(),
  selectedIds: [] as string[],
  onClearSelection: vi.fn(),
};

describe('ApprovalQueueToolbar', () => {
  it('renders all status chips', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} />);
    expect(screen.getByText('chips.all')).toBeInTheDocument();
    expect(screen.getByText('chips.pending')).toBeInTheDocument();
    expect(screen.getByText('chips.overdue')).toBeInTheDocument();
    expect(screen.getByText('chips.approved')).toBeInTheDocument();
    expect(screen.getByText('chips.rejected')).toBeInTheDocument();
  });

  it('calls onStatusChange when a chip is clicked', async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar {...defaultProps} onStatusChange={onStatusChange} />,
    );
    await user.click(screen.getByText('chips.pending'));
    expect(onStatusChange).toHaveBeenCalledWith('pending');
  });

  it('renders search input with placeholder', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument();
  });

  it('does not show bulk toolbar when no items selected', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} />);
    expect(screen.queryByText(/bulk\.approve/)).not.toBeInTheDocument();
  });

  it('shows bulk toolbar when items are selected', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a', 'b']} />);
    expect(screen.getByText('bulk.selectedCount(2)')).toBeInTheDocument();
    expect(screen.getByText('bulk.approve(2)')).toBeInTheDocument();
    expect(screen.getByText('bulk.reject(2)')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button is clicked', async () => {
    const onClearSelection = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar
        {...defaultProps}
        selectedIds={['a']}
        onClearSelection={onClearSelection}
      />,
    );
    await user.click(screen.getByText('bulk.clear'));
    expect(onClearSelection).toHaveBeenCalled();
  });

  // ---- Search input interaction ----
  it('updates local search on input', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps} />);
    const input = screen.getByPlaceholderText('searchPlaceholder');
    await user.type(input, 'abc');
    expect(input).toHaveValue('abc');
  });

  it('renders search input with initial value', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} search="existing query" />);
    expect(screen.getByPlaceholderText('searchPlaceholder')).toHaveValue('existing query');
  });

  // ---- Active status chip ----
  it("calls onStatusChange with 'all' when all chip clicked", async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar
        {...defaultProps}
        activeStatus="pending"
        onStatusChange={onStatusChange}
      />,
    );
    await user.click(screen.getByText('chips.all'));
    expect(onStatusChange).toHaveBeenCalledWith('all');
  });

  it("calls onStatusChange with 'overdue' when overdue chip clicked", async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar {...defaultProps} onStatusChange={onStatusChange} />,
    );
    await user.click(screen.getByText('chips.overdue'));
    expect(onStatusChange).toHaveBeenCalledWith('overdue');
  });

  it("calls onStatusChange with 'approved' when approved chip clicked", async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar {...defaultProps} onStatusChange={onStatusChange} />,
    );
    await user.click(screen.getByText('chips.approved'));
    expect(onStatusChange).toHaveBeenCalledWith('approved');
  });

  it("calls onStatusChange with 'rejected' when rejected chip clicked", async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <ApprovalQueueToolbar {...defaultProps} onStatusChange={onStatusChange} />,
    );
    await user.click(screen.getByText('chips.rejected'));
    expect(onStatusChange).toHaveBeenCalledWith('rejected');
  });

  // ---- Bulk toolbar with multiple items ----
  it('shows correct count for 5 selected items', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a', 'b', 'c', 'd', 'e']} />);
    expect(screen.getByText('bulk.selectedCount(5)')).toBeInTheDocument();
    expect(screen.getByText('bulk.approve(5)')).toBeInTheDocument();
    expect(screen.getByText('bulk.reject(5)')).toBeInTheDocument();
  });

  // ---- Bulk reject opens dialog ----
  it('opens reject dialog when reject button is clicked', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a', 'b']} />);
    await user.click(screen.getByText('bulk.reject(2)'));
    // Dialog should open
    expect(screen.getByText('bulkRejectDialog.heading(2)')).toBeInTheDocument();
  });

  it('renders comment textarea in reject dialog', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a']} />);
    await user.click(screen.getByText('bulk.reject(1)'));
    expect(screen.getByPlaceholderText('bulkRejectDialog.commentPlaceholder')).toBeInTheDocument();
  });
});
