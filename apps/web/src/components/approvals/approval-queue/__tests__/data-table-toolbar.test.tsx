import { describe, expect, it, vi } from 'vitest';
import { screen, setup } from '@/test/test-utils';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      if (params?.count) return `${key}(${params.count})`;
      return key;
    },
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: (_opts: Record<string, unknown>) => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    approval: {
      bulkApprove: { mutationOptions: (opts: Record<string, unknown>) => opts },
      bulkReject: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ApprovalQueueToolbar } from '../data-table-toolbar';

const defaultProps = {
  activeStatuses: [] as string[],
  onStatusChange: vi.fn(),
  search: '',
  onSearchChange: vi.fn(),
  selectedIds: [] as string[],
  onClearSelection: vi.fn(),
};

describe('ApprovalQueueToolbar', () => {
  it('renders the filter button', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} />);
    expect(screen.getByText('filters')).toBeInTheDocument();
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

  it('shows correct count for 5 selected items', () => {
    setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a', 'b', 'c', 'd', 'e']} />);
    expect(screen.getByText('bulk.selectedCount(5)')).toBeInTheDocument();
    expect(screen.getByText('bulk.approve(5)')).toBeInTheDocument();
    expect(screen.getByText('bulk.reject(5)')).toBeInTheDocument();
  });

  it('opens reject dialog when reject button is clicked', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a', 'b']} />);
    await user.click(screen.getByText('bulk.reject(2)'));
    expect(screen.getByText('bulkRejectDialog.heading(2)')).toBeInTheDocument();
  });

  it('renders comment textarea in reject dialog', async () => {
    const { user } = setup(<ApprovalQueueToolbar {...defaultProps} selectedIds={['a']} />);
    await user.click(screen.getByText('bulk.reject(1)'));
    expect(screen.getByPlaceholderText('bulkRejectDialog.commentPlaceholder')).toBeInTheDocument();
  });
});
