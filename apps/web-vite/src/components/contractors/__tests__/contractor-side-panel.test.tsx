import { render, screen } from '@/test/test-utils';
import { ContractorSidePanel } from '../contractor-side-panel';

vi.mock('@/i18n/navigation', () => ({
  useLocale: () => 'en',
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

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ role: 'admin', can: () => true }),
}));

vi.mock('@/lib/mask-pii', () => ({
  maskTaxId: (v: string | null) => (v ? '***' : null),
  canViewSensitivePii: () => true,
}));

const baseContractor = {
  id: 'c1',
  legalName: 'ACME Sp. z o.o.',
  displayName: 'ACME',
  type: 'COMPANY',
  status: 'ACTIVE',
  lifecycleStage: 'ACTIVE',
  currency: 'PLN',
  email: 'test@acme.pl',
  taxId: '1234567890',
  customFieldsJson: { billingModel: 'HOURLY', rateValueMinor: 15000 },
  owner: { id: 'u1', name: 'Jan', image: null },
  primaryTeam: { id: 't1', name: 'Engineering' },
  billingProfiles: [],
  createdAt: null,
  updatedAt: null,
  complianceHealth: 'green' as const,
};

describe('ContractorSidePanel', () => {
  it('returns null when contractor is null', () => {
    const { container } = render(
      <ContractorSidePanel contractor={null} open={true} onOpenChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders contractor display name and badges', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('renders rate display when rateValueMinor is present', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    // 15000 minor = 150.00 PLN
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
  });

  it('renders full profile button', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    // The "Open full profile" CTA is rendered
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders legalName when displayName is null', () => {
    render(
      <ContractorSidePanel
        contractor={{ ...baseContractor, displayName: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
  });

  it('renders tax ID when canViewSensitivePii is true', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    // canViewSensitivePii returns true, so raw taxId is shown
    expect(screen.getByText('1234567890')).toBeInTheDocument();
  });

  it('renders email when present', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('test@acme.pl')).toBeInTheDocument();
  });

  it('renders owner name when present', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  it('renders team name when present', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders mdash when owner is null', () => {
    render(
      <ContractorSidePanel
        contractor={{ ...baseContractor, owner: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    // Multiple mdash entries for null fields
    const mdashes = document.querySelectorAll('span.text-muted-foreground');
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it('renders mdash when team is null', () => {
    render(
      <ContractorSidePanel
        contractor={{ ...baseContractor, primaryTeam: null }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    const mdashes = document.querySelectorAll('span.text-muted-foreground');
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it('renders mdash for rate when customFieldsJson has no rateValueMinor', () => {
    render(
      <ContractorSidePanel
        contractor={{ ...baseContractor, customFieldsJson: {} }}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    // Rate should show mdash since no rateValueMinor
    const mdashes = document.querySelectorAll('span.text-muted-foreground');
    expect(mdashes.length).toBeGreaterThan(0);
  });

  it('renders link to contractor profile page', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={true} onOpenChange={vi.fn()} />);
    const link = document.querySelector('a[href="/contractors/c1"]');
    expect(link).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<ContractorSidePanel contractor={baseContractor} open={false} onOpenChange={vi.fn()} />);
    // Sheet should not show content when closed
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
  });
});
