import { render, screen } from '@/test/test-utils';
import { TabContracts } from '../tab-contracts';

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn<() => Record<string, unknown>>(() => ({
    data: null,
    isLoading: false,
    isFetching: false,
    isPending: false,
  })),
}));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      list: {
        queryOptions: (input: unknown) => ({ queryKey: ['contract', 'list', input] }),
      },
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
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/contracts/contract-wizard/wizard-dialog', () => ({
  ContractWizardDialog: () => null,
}));

describe('TabContracts', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      isPending: false,
    });
  });

  it('renders empty state when no contracts', () => {
    render(<TabContracts contractorId="c1" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders loading skeletons', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabContracts contractorId="c1" />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state heading and body text', () => {
    render(<TabContracts contractorId="c1" />);
    expect(screen.getByText(/no contracts/i)).toBeInTheDocument();
  });

  it('renders table when contracts exist', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'ct-1',
            title: 'Dev Contract',
            status: 'ACTIVE',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            rateValueMinor: 500000,
            currency: 'PLN',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabContracts contractorId="c1" />);
    expect(screen.getByText('Dev Contract')).toBeInTheDocument();
  });

  it('renders ACTIVE status badge', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'ct-1',
            title: 'Test',
            status: 'ACTIVE',
            startDate: null,
            endDate: null,
            rateValueMinor: null,
            currency: 'PLN',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabContracts contractorId="c1" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders formatted rate value', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'ct-1',
            title: 'Test',
            status: 'ACTIVE',
            startDate: null,
            endDate: null,
            rateValueMinor: 500000,
            currency: 'PLN',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabContracts contractorId="c1" />);
    expect(screen.getByText(/5.*000/)).toBeInTheDocument();
  });

  it('renders add contract button in populated state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'ct-1',
            title: 'Test',
            status: 'ACTIVE',
            startDate: null,
            endDate: null,
            rateValueMinor: null,
            currency: 'PLN',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabContracts contractorId="c1" />);
    expect(screen.getByText(/add contract/i)).toBeInTheDocument();
  });

  it('shows dash for null dates', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'ct-1',
            title: 'Test',
            status: 'DRAFT',
            startDate: null,
            endDate: null,
            rateValueMinor: null,
            currency: 'PLN',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      isPending: false,
    });

    render(<TabContracts contractorId="c1" />);
    // mdash characters should be present for null dates and rate
    const { container } = render(<TabContracts contractorId="c1" />);
    const dashes = container.querySelectorAll('.text-muted-foreground');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders multiple loading skeletons', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      isPending: true,
    });

    const { container } = render(<TabContracts contractorId="c1" />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });
});
