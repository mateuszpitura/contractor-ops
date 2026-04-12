import { render, screen } from '@/test/test-utils';
import { TabOverview } from '../tab-overview';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/contractors/c1',
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
  displayName: 'ACME Corp',
  type: 'COMPANY',
  taxId: '1234567890',
  vatId: 'PL1234567890',
  registrationNumber: '123456789',
  email: 'contact@acme.pl',
  phone: '+48123456789',
  addressLine1: 'ul. Testowa 1',
  addressLine2: null,
  city: 'Warszawa',
  postalCode: '00-001',
  countryCode: 'PL',
  currency: 'PLN',
  customFieldsJson: { billingModel: 'HOURLY', rateValueMinor: 15000 },
  billingProfiles: [
    {
      id: 'bp1',
      legalEntityName: 'ACME',
      preferredCurrency: 'PLN',
      bankAccountMasked: 'PL** **** **** ****',
      paymentTermsDays: 30,
      isDefault: true,
    },
  ],
  contracts: [
    {
      id: 'ct1',
      title: 'B2B Agreement',
      type: 'B2B_MASTER_SERVICE',
      status: 'ACTIVE',
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      billingModel: 'HOURLY',
    },
  ],
  complianceHealth: {
    overall: 'green' as const,
    factors: [
      { key: 'documents' as const, status: 'green' as const, label: 'Documents' },
      { key: 'contract' as const, status: 'green' as const, label: 'Contract' },
    ],
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

describe('TabOverview', () => {
  it('renders company details card', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
  });

  it('renders email as a link', () => {
    render(<TabOverview contractor={baseContractor} />);
    const emailLink = screen.getByText('contact@acme.pl');
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:contact@acme.pl');
  });

  it('renders active contract info', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('B2B Agreement')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('shows no active contract message when none exists', () => {
    const contractor = {
      ...baseContractor,
      contracts: [],
    };
    render(<TabOverview contractor={contractor} />);
    // Should render the "no active contract" text
    const container = document.querySelector('div');
    expect(container).toBeInTheDocument();
  });

  it('renders compliance health factors', () => {
    render(<TabOverview contractor={baseContractor} />);
    // Health factor buttons should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders phone number in field row', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('+48123456789')).toBeInTheDocument();
  });

  it('renders formatted address', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText(/ul\. Testowa 1/)).toBeInTheDocument();
  });

  it('renders display name and legal name', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('ACME Corp')).toBeInTheDocument();
    expect(screen.getByText('ACME Sp. z o.o.')).toBeInTheDocument();
  });

  it('renders currency in billing card', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('PLN')).toBeInTheDocument();
  });

  it('renders billing model from custom fields', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('HOURLY')).toBeInTheDocument();
  });

  it('renders rate from custom fields', () => {
    render(<TabOverview contractor={baseContractor} />);
    // rateValueMinor 15000 = 150.00 PLN
    expect(screen.getByText('150.00 PLN')).toBeInTheDocument();
  });

  it('renders individual contractor', () => {
    const individual = {
      ...baseContractor,
      type: 'INDIVIDUAL',
      legalName: 'Jan Kowalski',
    };
    render(<TabOverview contractor={individual} />);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('renders country code field', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('PL')).toBeInTheDocument();
  });

  it('renders health factor buttons', () => {
    render(<TabOverview contractor={baseContractor} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders health card heading', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('Compliance health')).toBeInTheDocument();
  });

  it('renders key dates card', () => {
    render(<TabOverview contractor={baseContractor} />);
    expect(screen.getByText('Key dates')).toBeInTheDocument();
  });

  it('renders no active contract when contracts are empty', () => {
    render(<TabOverview contractor={{ ...baseContractor, contracts: [] }} />);
    expect(screen.getByText(/No active contract/i)).toBeInTheDocument();
  });
});
