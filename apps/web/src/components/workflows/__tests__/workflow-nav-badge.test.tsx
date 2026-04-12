import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { WorkflowNavBadge } from '../workflow-nav-badge';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      overdueCount: { queryOptions: () => ({ queryKey: ['workflow', 'overdueCount'] }) },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('WorkflowNavBadge', () => {
  it('renders nothing when count is 0', () => {
    mockedUseQuery.mockReturnValue({ data: { count: 0 } } as unknown);
    const { container } = render(<WorkflowNavBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders count when there are overdue tasks', () => {
    mockedUseQuery.mockReturnValue({ data: { count: 5 } } as unknown);
    render(<WorkflowNavBadge />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders 9+ when count exceeds 9', () => {
    mockedUseQuery.mockReturnValue({ data: { count: 15 } } as unknown);
    render(<WorkflowNavBadge />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    mockedUseQuery.mockReturnValue({ data: { count: 3 } } as unknown);
    render(<WorkflowNavBadge />);
    const badge = screen.getByText('3');
    expect(badge).toHaveAttribute('aria-label');
  });
});
