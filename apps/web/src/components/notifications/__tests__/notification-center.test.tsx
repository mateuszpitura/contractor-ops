import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { NotificationCenter } from '../notification-center';

const { mockUseQuery, mockUseMutation, mockPush } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
    useMutation: mockUseMutation,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    notification: {
      list: {
        queryOptions: (input: unknown) => ({
          queryKey: ['notification', 'list', input],
          queryFn: vi.fn(),
        }),
      },
      unreadCount: {
        queryOptions: () => ({
          queryKey: ['notification', 'unreadCount'],
          queryFn: vi.fn(),
        }),
      },
      markRead: {
        mutationOptions: (opts: Record<string, unknown>) => ({ ...opts }),
      },
      markAllRead: {
        mutationOptions: (opts: Record<string, unknown>) => ({ ...opts }),
      },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/notifications',
}));

vi.mock('nuqs', () => ({
  parseAsString: {
    withDefault: () => ({}),
  },
  parseAsInteger: {
    withDefault: () => ({}),
  },
  useQueryState: (key: string) => {
    const defaults: Record<string, unknown> = {
      type: 'all',
      unread: '',
      page: 1,
    };
    return [defaults[key], vi.fn()];
  },
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/shared/animate-in', () => ({
  AnimateIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/shared/empty-state', () => ({
  EmptyState: ({ heading, body }: { heading: string; body: string }) => (
    <div>
      <h2>{heading}</h2>
      <p>{body}</p>
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders page title', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
    });
    render(<NotificationCenter />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders filter chips', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
    });
    render(<NotificationCenter />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('renders mark all read button', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
    });
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /Mark all read/i })).toBeInTheDocument();
  });

  it('disables mark all read button when unread count is 0', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [], total: 0, page: 1, totalPages: 1 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 0 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /Mark all read/i })).toBeDisabled();
  });

  it('renders empty state when no notifications', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [], total: 0, page: 1, totalPages: 1 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 0 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('renders unread only toggle', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], total: 0, page: 1, totalPages: 1 },
      isLoading: false,
    });
    render(<NotificationCenter />);
    expect(screen.getByText('Unread only')).toBeInTheDocument();
  });

  it('shows loading skeletons when list is loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { container } = render(<NotificationCenter />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders notification items when data is present', () => {
    const items = [
      {
        id: 'n1',
        type: 'TASK_ASSIGNED',
        title: 'Task assigned',
        body: 'You got a task',
        entityType: 'task',
        entityId: 'task-1',
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'n2',
        type: 'INVOICE_RECEIVED',
        title: 'Invoice received',
        body: 'New invoice',
        entityType: 'invoice',
        entityId: 'inv-1',
        readAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    mockUseQuery
      .mockReturnValueOnce({
        data: { items, total: 2, page: 1, totalPages: 1 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 1 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    // Items should be present (notifications render in bordered divs)
    const bordered = document.querySelectorAll('.border-b');
    expect(bordered.length).toBeGreaterThan(0);
  });

  it('renders pagination when totalPages > 1', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [{ id: 'n1', type: 'TASK_ASSIGNED', title: 'T', body: 'B', entityType: 'task', entityId: 't1', readAt: null, createdAt: new Date().toISOString() }], total: 20, page: 1, totalPages: 2 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 5 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [{ id: 'n1', type: 'TASK_ASSIGNED', title: 'T', body: 'B', entityType: 'task', entityId: 't1', readAt: null, createdAt: new Date().toISOString() }], total: 20, page: 1, totalPages: 2 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 5 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    const prevBtn = screen.getByText('Previous').closest('button');
    expect(prevBtn).toBeDisabled();
  });

  it('calls markAllRead when mark all read button is clicked', async () => {
    const mockMutate = vi.fn();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [], total: 0, page: 1, totalPages: 1 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 3 },
        isLoading: false,
      });
    const { user } = setup(<NotificationCenter />);
    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    await user.click(markAllBtn);
    expect(mockMutate).toHaveBeenCalled();
  });

  it('enables mark all read button when unread count > 0', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [], total: 0, page: 1, totalPages: 1 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { count: 5 },
        isLoading: false,
      });
    render(<NotificationCenter />);
    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    expect(markAllBtn).not.toBeDisabled();
  });
});
