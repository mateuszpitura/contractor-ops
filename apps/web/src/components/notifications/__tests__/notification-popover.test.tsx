import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { NotificationPopover } from '../notification-popover';

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

  it('computes badgeText as "1" for unread count of 1', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { count: 1 }, isLoading: false })
      .mockReturnValueOnce({ data: { items: [] }, isLoading: false });
    render(<NotificationPopover />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders aria-label with unread count when count > 0', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { count: 3 }, isLoading: false })
      .mockReturnValueOnce({ data: { items: [] }, isLoading: false });
    render(<NotificationPopover />);
    // The trigger button should have an accessible label mentioning the count
    const buttons = screen.getAllByRole('button');
    const triggerButton = buttons.find(b => b.getAttribute('aria-label')?.includes('3'));
    expect(triggerButton).toBeTruthy();
  });

  it('renders aria-label as plain title when count is 0', () => {
    mockUseQuery.mockReturnValue({
      data: { count: 0, items: [] },
      isLoading: false,
    });
    render(<NotificationPopover />);
    const buttons = screen.getAllByRole('button');
    const triggerButton = buttons.find(b => b.getAttribute('aria-label') === 'Notifications');
    expect(triggerButton).toBeTruthy();
  });

  it('renders badge with aria-live polite for screen readers', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { count: 2 }, isLoading: false })
      .mockReturnValueOnce({ data: { items: [] }, isLoading: false });
    render(<NotificationPopover />);
    const badge = screen.getByText('2');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('aria-atomic', 'true');
  });

  it('initializes both mutations via useMutation', () => {
    mockUseQuery.mockReturnValue({
      data: { count: 0, items: [] },
      isLoading: false,
    });
    render(<NotificationPopover />);
    // useMutation is called twice: markRead + markAllRead
    expect(mockUseMutation).toHaveBeenCalledTimes(2);
  });

  it('handles undefined unread data gracefully', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: true })
      .mockReturnValueOnce({ data: undefined, isLoading: true });
    render(<NotificationPopover />);
    // No badge should be shown when data is undefined (count defaults to 0)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows unread badge for count exactly 99', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { count: 99 }, isLoading: false })
      .mockReturnValueOnce({ data: { items: [] }, isLoading: false });
    render(<NotificationPopover />);
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.queryByText('99+')).not.toBeInTheDocument();
  });

  it('shows 99+ badge for count exactly 100', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { count: 100 }, isLoading: false })
      .mockReturnValueOnce({ data: { items: [] }, isLoading: false });
    render(<NotificationPopover />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
