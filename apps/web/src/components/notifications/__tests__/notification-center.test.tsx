import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { NotificationCenter } from '../notification-center';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

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

const mockPush = vi.fn();
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
      <div {...props}>{children}</div>
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
});
