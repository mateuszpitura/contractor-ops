import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseQueryClient = vi.hoisted(() => vi.fn(() => ({ invalidateQueries: vi.fn() })));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: mockUseQuery, useQueryClient: mockUseQueryClient };
});

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

// Mock child wizard to avoid pulling its full dependency tree
vi.mock('../onboarding-wizard', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard">Wizard</div>,
}));

import { ZatcaStatusCard } from '../zatca-status-card';

describe('ZatcaStatusCard', () => {
  it('renders not-connected state with connect CTA when no data', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<ZatcaStatusCard />);
    expect(screen.getByRole('button', { name: 'Connect to ZATCA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect to ZATCA' })).toBeInTheDocument();
    expect(screen.getByText(/Submit e-invoices to ZATCA/)).toBeInTheDocument();
  });

  it('renders onboarding-in-progress state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: false,
        currentStep: 'csr_generation',
        complianceCsidReceived: false,
      },
      isLoading: false,
    });
    render(<ZatcaStatusCard />);
    expect(
      screen.getByText('Onboarding in progress — continue the setup wizard.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Continue Setup')).toBeInTheDocument();
  });

  it('renders connected production state with Manage and Disconnect buttons', () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: true,
        currentStep: 'production_certificate',
        complianceCsidReceived: true,
      },
      isLoading: false,
    });
    render(<ZatcaStatusCard />);
    expect(screen.getByText('ZATCA (Saudi Arabia)')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});
