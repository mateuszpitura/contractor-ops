import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { NotificationPopover } from '../notification-popover';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
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
        mutationOptions: (opts: any) => ({ ...opts }),
      },
      markAllRead: {
        mutationOptions: (opts: any) => ({ ...opts }),
      },
    },
  },
}));

const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
  usePathname: () => '/test',
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('NotificationPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders bell trigger button', () => {
    mockUseQuery.mockReturnValue({
      data: { count: 0 },
      isLoading: false,
    });
    render(<NotificationPopover />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows unread badge when count > 0', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { count: 5 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { items: [] },
        isLoading: false,
      });
    render(<NotificationPopover />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps unread badge at 99+', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { count: 150 },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { items: [] },
        isLoading: false,
      });
    render(<NotificationPopover />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not show badge when unread count is 0', () => {
    mockUseQuery.mockReturnValue({
      data: { count: 0, items: [] },
      isLoading: false,
    });
    render(<NotificationPopover />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
