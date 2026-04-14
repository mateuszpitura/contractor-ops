import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseQueryClient = vi.hoisted(() => vi.fn(() => ({ invalidateQueries: vi.fn() })));

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: mockUseQuery, useQueryClient: mockUseQueryClient };
});

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string) => {
      const translations: Record<string, string> = {
        title: 'ZATCA Onboarding',
        'steps.taxDetails': 'Tax Details',
        'steps.taxDetailsShort': 'Tax',
        'steps.csrGeneration': 'CSR Generation',
        'steps.csrGenerationShort': 'CSR',
        'steps.complianceCsid': 'Compliance CSID',
        'steps.complianceCsidShort': 'CSID',
        'steps.complianceChecks': 'Compliance Checks',
        'steps.complianceChecksShort': 'Checks',
        'steps.productionCertificate': 'Production Certificate',
        'steps.productionCertificateShort': 'Cert',
      };
      return translations[key] ?? key;
    },
  };
});

// Mock child step components to isolate wizard orchestration
vi.mock('../tax-details-form', () => ({
  TaxDetailsForm: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="tax-details-form">
      <button type="button" onClick={onSuccess}>
        Next
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));
vi.mock('../csr-generation', () => ({
  CsrGeneration: () => <div data-testid="csr-generation">CSR Step</div>,
}));
vi.mock('../compliance-csid', () => ({
  ComplianceCsid: () => <div data-testid="compliance-csid">CSID Step</div>,
}));
vi.mock('../compliance-checks', () => ({
  ComplianceChecks: () => <div data-testid="compliance-checks">Checks Step</div>,
}));
vi.mock('../production-certificate', () => ({
  ProductionCertificate: () => <div data-testid="production-certificate">Cert Step</div>,
}));

import { OnboardingWizard } from '../onboarding-wizard';

describe('OnboardingWizard', () => {
  const defaultProps = {
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders loading skeleton when query is loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<OnboardingWizard {...defaultProps} />);
    // Skeleton elements are rendered
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders stepper and first step content when data is loaded', () => {
    mockUseQuery.mockReturnValue({
      data: { currentStep: 'tax_details' },
      isLoading: false,
    });
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('ZATCA Onboarding')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Onboarding progress' })).toBeInTheDocument();
    expect(screen.getByTestId('tax-details-form')).toBeInTheDocument();
  });

  it('renders second step when server state is csr_generation', () => {
    mockUseQuery.mockReturnValue({
      data: { currentStep: 'csr_generation' },
      isLoading: false,
    });
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByTestId('csr-generation')).toBeInTheDocument();
  });

  it('renders compliance checks step (step 4)', () => {
    mockUseQuery.mockReturnValue({
      data: { currentStep: 'compliance_checks' },
      isLoading: false,
    });
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByTestId('compliance-checks')).toBeInTheDocument();
  });

  it('renders production certificate step (step 5)', () => {
    mockUseQuery.mockReturnValue({
      data: { currentStep: 'production_certificate' },
      isLoading: false,
    });
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByTestId('production-certificate')).toBeInTheDocument();
  });

  it('defaults to step 0 when currentStep is missing', () => {
    mockUseQuery.mockReturnValue({
      data: {},
      isLoading: false,
    });
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByTestId('tax-details-form')).toBeInTheDocument();
  });
});
