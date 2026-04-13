import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { ActivityFeed } from '../activity-feed';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    dashboard: {
      activity: { queryOptions: () => ({ queryKey: ['dashboard', 'activity'] }) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('ActivityFeed', () => {
  it('shows loading skeletons', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown);
    const { container } = render(<ActivityFeed />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('shows empty state when no activity', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders activity title', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });

  it('renders see all link to audit log settings', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const seeAll = screen.getByText('See all activity').closest('a');
    expect(seeAll?.getAttribute('href')).toBe('/settings?tab=audit-log');
  });

  it('renders activity items grouped by day', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a1',
            actorName: 'Jan',
            actorType: 'USER',
            action: 'CREATED',
            resourceType: 'CONTRACTOR',
            resourceId: 'c1',
            resourceName: 'Acme',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('shows System when actorName is null', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a2',
            actorName: null,
            actorType: 'SYSTEM',
            action: 'CREATE',
            resourceType: 'DOCUMENT',
            resourceId: 'd1',
            resourceName: 'Policy.pdf',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('links invoice activity to the invoice detail route', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a3',
            actorName: 'User',
            actorType: 'USER',
            action: 'UPDATE',
            resourceType: 'INVOICE',
            resourceId: 'inv-7',
            resourceName: 'FV/1',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'FV/1' });
    expect(link.getAttribute('href')).toBe('/invoices/inv-7');
  });

  it('shows Today section header for same-calendar-day activity', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a4',
            actorName: 'Lee',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'CONTRACTOR',
            resourceId: 'c9',
            resourceName: 'Beta',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it("shows Yesterday section header for yesterday's activity", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a5',
            actorName: 'Kim',
            actorType: 'USER',
            action: 'UPDATE',
            resourceType: 'CONTRACT',
            resourceId: 'ct-1',
            resourceName: 'MSA',
            createdAt: yesterday.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('shows Earlier section header for older activity', () => {
    const earlier = new Date();
    earlier.setDate(earlier.getDate() - 5);
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a6',
            actorName: 'Old',
            actorType: 'USER',
            action: 'DELETE',
            resourceType: 'DOCUMENT',
            resourceId: 'd2',
            resourceName: 'Old doc',
            createdAt: earlier.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Earlier')).toBeInTheDocument();
  });

  it('links contract activity to the contract detail route', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a7',
            actorName: 'User',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'CONTRACT',
            resourceId: 'ct-5',
            resourceName: 'SOW',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'SOW' });
    expect(link.getAttribute('href')).toBe('/contracts/ct-5');
  });

  it('links workflow activity to workflows page', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a8',
            actorName: 'User',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'WORKFLOW_TEMPLATE',
            resourceId: 'wf-1',
            resourceName: 'Onboarding',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'Onboarding' });
    expect(link.getAttribute('href')).toBe('/workflows');
  });

  it('links payment activity to payments page', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a9',
            actorName: 'User',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'PAYMENT_RUN',
            resourceId: 'pr-1',
            resourceName: 'March batch',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'March batch' });
    expect(link.getAttribute('href')).toBe('/payments');
  });

  it('shows resourceId as link text when resourceName is null', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a10',
            actorName: 'User',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'CONTRACTOR',
            resourceId: 'c99',
            resourceName: null,
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('c99')).toBeInTheDocument();
  });

  it('links document activity to documents page', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a11',
            actorName: 'Admin',
            actorType: 'USER',
            action: 'UPLOAD',
            resourceType: 'DOCUMENT',
            resourceId: 'd99',
            resourceName: 'NDA.pdf',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'NDA.pdf' });
    expect(link.getAttribute('href')).toBe('/documents');
  });

  it('links contractor activity to contractor detail route', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a12',
            actorName: 'HR',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'CONTRACTOR',
            resourceId: 'c55',
            resourceName: 'Gamma LLC',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    const link = screen.getByRole('link', { name: 'Gamma LLC' });
    expect(link.getAttribute('href')).toBe('/contractors/c55');
  });

  it('renders multiple activities from same day in Today section', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a13',
            actorName: 'User A',
            actorType: 'USER',
            action: 'CREATE',
            resourceType: 'CONTRACTOR',
            resourceId: 'c1',
            resourceName: 'Alpha',
            createdAt: now.toISOString(),
          },
          {
            id: 'a14',
            actorName: 'User B',
            actorType: 'USER',
            action: 'UPDATE',
            resourceType: 'CONTRACT',
            resourceId: 'ct1',
            resourceName: 'Beta Contract',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta Contract')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders delete action activity', () => {
    const now = new Date();
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'a15',
            actorName: 'Admin',
            actorType: 'USER',
            action: 'DELETE',
            resourceType: 'CONTRACTOR',
            resourceId: 'c77',
            resourceName: 'Deleted Corp',
            createdAt: now.toISOString(),
          },
        ],
      },
      isLoading: false,
    } as unknown);
    render(<ActivityFeed />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
