import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@/test/test-utils';
import { ApprovalQueueWidget } from '../approval-queue-widget';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    approval: {
      listPending: { queryOptions: () => ({ queryKey: ['approval', 'listPending'] }) },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('ApprovalQueueWidget', () => {
  it('shows loading skeletons', () => {
    mockedUseQuery.mockReturnValue({ data: undefined, isLoading: true } as unknown as never);
    const { container } = render(<ApprovalQueueWidget />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('shows empty state when no pending approvals', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    expect(screen.getByText('No pending approvals')).toBeInTheDocument();
  });

  it('renders widget title and see all link', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    expect(screen.getByText('Approval queue')).toBeInTheDocument();
    expect(screen.getByText('See all approvals')).toBeInTheDocument();
  });

  it('renders approval items with contractor name', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 's1',
            invoice: {
              contractor: { legalName: 'Acme sp. z o.o.' },
              sellerName: null,
              totalMinor: 100000,
              currency: 'PLN',
            },
            approvalFlow: { resourceId: 'inv-1' },
            slaStatus: { status: 'green' },
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    expect(screen.getByText('Acme sp. z o.o.')).toBeInTheDocument();
  });

  it('falls back to sellerName when contractor legal name is absent', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 's2',
            invoice: {
              contractor: null,
              sellerName: 'Vendor Ltd',
              totalMinor: 5000,
              currency: 'PLN',
            },
            approvalFlow: { resourceId: 'inv-2' },
            slaStatus: { status: 'yellow' },
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    expect(screen.getByText('Vendor Ltd')).toBeInTheDocument();
  });

  it('links to invoice detail when resourceId is set', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 's3',
            invoice: {
              contractor: { legalName: 'X' },
              sellerName: null,
              totalMinor: 0,
              currency: 'PLN',
            },
            approvalFlow: { resourceId: 'inv-42' },
            slaStatus: { status: 'green' },
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    const link = screen.getByRole('link', { name: /X/ });
    expect(link.getAttribute('href')).toBe('/invoices/inv-42');
  });

  it('links to approvals list when resourceId is missing', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 's4',
            invoice: {
              contractor: { legalName: 'Orphan' },
              sellerName: null,
              totalMinor: 100,
              currency: 'PLN',
            },
            approvalFlow: {},
            slaStatus: { status: 'green' },
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    const link = screen.getByRole('link', { name: /Orphan/ });
    expect(link.getAttribute('href')).toBe('/approvals');
  });

  it('shows breached SLA label for red status', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 's5',
            invoice: {
              contractor: { legalName: 'Late Co' },
              sellerName: null,
              totalMinor: 99900,
              currency: 'PLN',
            },
            approvalFlow: { resourceId: 'inv-9' },
            slaStatus: { status: 'red' },
          },
        ],
      },
      isLoading: false,
    } as unknown as never);
    render(<ApprovalQueueWidget />);
    expect(screen.getByText('Breached')).toBeInTheDocument();
  });
});
