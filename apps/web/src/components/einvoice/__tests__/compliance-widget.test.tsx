import { render, screen } from '@/test/test-utils';
import { EInvoiceComplianceWidget } from '../compliance-widget';

const mockStatuses = vi.hoisted(() => ({
  statuses: [
    { profileId: 'sa-1', displayName: 'Saudi Arabia', state: 'active' },
    { profileId: 'de-1', displayName: 'Germany', state: 'sandbox' },
  ],
}));

vi.mock('@contractor-ops/einvoice', () => ({
  complianceState: { notConnected: 'not-connected' },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey: string[] }) => {
      if (opts.queryKey?.includes('peppol')) {
        return { data: null, isLoading: false };
      }
      return { data: mockStatuses, isLoading: false };
    },
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    einvoice: {
      complianceStatuses: {
        queryOptions: vi.fn(() => ({ queryKey: ['einvoice', 'complianceStatuses'] })),
      },
    },
    peppol: {
      getStatus: {
        queryOptions: vi.fn(() => ({ queryKey: ['peppol', 'getStatus'] })),
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
    [k: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
}));

vi.mock('@/components/peppol/peppol-compliance-widget', () => ({
  PeppolComplianceWidget: () => <div data-testid="peppol-widget">Peppol Widget</div>,
}));

describe('EInvoiceComplianceWidget', () => {
  it('renders the widget title', () => {
    render(<EInvoiceComplianceWidget />);
    expect(screen.getByText('E-Invoicing Compliance')).toBeInTheDocument();
  });

  it('renders country display names from statuses', () => {
    render(<EInvoiceComplianceWidget />);
    expect(screen.getByText('Saudi Arabia')).toBeInTheDocument();
    expect(screen.getByText('Germany')).toBeInTheDocument();
  });

  it('renders state labels for each status', () => {
    render(<EInvoiceComplianceWidget />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Sandbox')).toBeInTheDocument();
  });

  it('renders links to settings', () => {
    render(<EInvoiceComplianceWidget />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/settings#einvoice');
  });
});
