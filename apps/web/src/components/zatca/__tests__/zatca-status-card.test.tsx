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

  it('opens onboarding wizard when Connect to ZATCA is clicked', async () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ZatcaStatusCard />);
    await user.click(screen.getByRole('button', { name: 'Connect to ZATCA' }));
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('opens wizard when Continue Setup is clicked in onboarding state', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: false,
        currentStep: 'csr_generation',
        complianceCsidReceived: false,
      },
      isLoading: false,
    });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ZatcaStatusCard />);
    await user.click(screen.getByText('Continue Setup'));
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('renders Onboarding badge in onboarding state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: false,
        currentStep: 'compliance_csid',
        complianceCsidReceived: true,
      },
      isLoading: false,
    });
    render(<ZatcaStatusCard />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('renders not-connected state when currentStep is tax_details and not production', () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: false,
        currentStep: 'tax_details',
        complianceCsidReceived: false,
      },
      isLoading: false,
    });
    render(<ZatcaStatusCard />);
    // tax_details step with no production cert is not considered "onboarding"
    // so it falls to the not-connected state
    expect(screen.getByRole('button', { name: 'Connect to ZATCA' })).toBeInTheDocument();
  });

  it('renders Manage link pointing to ZATCA settings page', () => {
    mockUseQuery.mockReturnValue({
      data: {
        productionCertActive: true,
        currentStep: 'production_certificate',
        complianceCsidReceived: true,
      },
      isLoading: false,
    });
    render(<ZatcaStatusCard />);
    const manageLink = screen.getByText('Manage').closest('a');
    expect(manageLink).toHaveAttribute('href', '/settings/integrations/zatca');
  });
});
