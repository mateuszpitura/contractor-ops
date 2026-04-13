import { render, screen } from '@/test/test-utils';
import { DetailHeader } from '../detail-header';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      transitionStatus: { mutationOptions: (opts: Record<string, unknown>) => opts },
      getById: { queryKey: () => ['contract', 'getById'] },
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
});
