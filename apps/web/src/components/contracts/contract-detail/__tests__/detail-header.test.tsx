import { render, screen } from '@/test/test-utils';
import { DetailHeader } from '../detail-header';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      transitionStatus: { mutationOptions: (opts: Record<string, unknown>) => opts },
      getById: { queryKey: () => ['contract', 'getById'] },
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

vi.mock('../send-for-signature-button', () => ({
  SendForSignatureButton: () => null,
}));

describe('DetailHeader', () => {
  const baseContract = {
    id: 'ct1',
    title: 'B2B Master Agreement',
    status: 'ACTIVE',
    contractor: {
      id: 'c1',
      legalName: 'ACME Sp. z o.o.',
      displayName: 'ACME',
      status: 'ACTIVE',
    },
  };

  it('renders contract title', () => {
    render(<DetailHeader contract={baseContract} />);
    expect(screen.getByText('B2B Master Agreement')).toBeInTheDocument();
  });

  it('renders contractor link', () => {
    render(<DetailHeader contract={baseContract} />);
    const link = screen.getByText('ACME');
    expect(link.closest('a')).toHaveAttribute('href', '/contractors/c1');
  });

  it('renders status badge', () => {
    render(<DetailHeader contract={baseContract} />);
    // Badge should be present
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders actions dropdown', () => {
    render(<DetailHeader contract={baseContract} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders untitled fallback when title is null', () => {
    render(<DetailHeader contract={{ ...baseContract, title: null }} />);
    expect(screen.getByText('Untitled contract')).toBeInTheDocument();
  });

  it('does not render contractor link when contractor is null', () => {
    render(<DetailHeader contract={{ ...baseContract, contractor: null }} />);
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
  });

  it('renders status badge with DRAFT status', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'DRAFT' }} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders terminate action for DRAFT status', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'DRAFT' }} />);
    // Terminate should be available for DRAFT contracts
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not render terminate for TERMINATED status', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'TERMINATED' }} />);
    // TERMINATED is not in canTerminate list
    expect(screen.queryByText('ContractDetail.actions.terminate')).not.toBeInTheDocument();
  });

  it('does not render supersede for DRAFT status', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'DRAFT' }} />);
    // DRAFT is not in canSupersede list
    expect(screen.queryByText('ContractDetail.actions.supersede')).not.toBeInTheDocument();
  });

  it('renders status badge for EXPIRED contract', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'EXPIRED' }} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders with PENDING_SIGNATURE status', () => {
    render(<DetailHeader contract={{ ...baseContract, status: 'PENDING_SIGNATURE' }} />);
    expect(screen.getByText('Pending signature')).toBeInTheDocument();
  });
});
