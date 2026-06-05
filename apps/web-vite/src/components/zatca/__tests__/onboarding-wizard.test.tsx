/**
 * OnboardingWizardView is pure presentational; child step containers are
 * mocked so the test asserts the wizard orchestration (loading skeleton,
 * stepper title, which step is mounted for the active index).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { useTranslations } from '../../../i18n/useTranslations';

vi.mock('../tax-details-form-container', () => ({
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
vi.mock('../csr-generation-container', () => ({
  CsrGeneration: () => <div data-testid="csr-generation">CSR Step</div>,
}));
vi.mock('../compliance-csid-container', () => ({
  ComplianceCsid: () => <div data-testid="compliance-csid">CSID Step</div>,
}));
vi.mock('../compliance-checks-container', () => ({
  ComplianceChecks: () => <div data-testid="compliance-checks">Checks Step</div>,
}));
vi.mock('../production-certificate-container', () => ({
  ProductionCertificate: () => <div data-testid="production-certificate">Cert Step</div>,
}));

import { OnboardingWizardSkeleton, OnboardingWizardView } from '../onboarding-wizard';
import type { StepDefinition } from '../stepper';

const STEPS: StepDefinition[] = [
  { id: 'tax_details', label: 'Tax Details', shortLabel: 'Tax' },
  { id: 'csr_generation', label: 'CSR Generation', shortLabel: 'CSR' },
  { id: 'compliance_csid', label: 'Compliance CSID', shortLabel: 'CSID' },
  { id: 'compliance_checks', label: 'Compliance Checks', shortLabel: 'Checks' },
  { id: 'production_certificate', label: 'Production Certificate', shortLabel: 'Cert' },
];

interface Overrides {
  activeStep?: number;
  goNext?: () => void;
  goBack?: () => void;
  goToStep?: (index: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

function Harness(props: Overrides) {
  const t = useTranslations('Zatca.onboarding');
  return (
    <OnboardingWizardView
      onComplete={props.onComplete ?? vi.fn()}
      onCancel={props.onCancel ?? vi.fn()}
      onboardingSteps={STEPS}
      activeStep={props.activeStep ?? 0}
      goNext={props.goNext ?? vi.fn()}
      goBack={props.goBack ?? vi.fn()}
      goToStep={props.goToStep ?? vi.fn()}
      t={t}
    />
  );
}

describe('OnboardingWizard (web-vite)', () => {
  it('renders loading skeleton sibling', () => {
    const { container } = render(<OnboardingWizardSkeleton />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders title and stepper when not loading', () => {
    render(<Harness />);
    expect(screen.getByText('ZATCA Onboarding')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Onboarding progress' })).toBeInTheDocument();
  });

  it('renders TaxDetailsForm for step 0', () => {
    render(<Harness activeStep={0} />);
    expect(screen.getByTestId('tax-details-form')).toBeInTheDocument();
  });

  it('renders CsrGeneration for step 1', () => {
    render(<Harness activeStep={1} />);
    expect(screen.getByTestId('csr-generation')).toBeInTheDocument();
  });

  it('renders ComplianceCsid for step 2', () => {
    render(<Harness activeStep={2} />);
    expect(screen.getByTestId('compliance-csid')).toBeInTheDocument();
  });

  it('renders ComplianceChecks for step 3', () => {
    render(<Harness activeStep={3} />);
    expect(screen.getByTestId('compliance-checks')).toBeInTheDocument();
  });

  it('renders ProductionCertificate for step 4', () => {
    render(<Harness activeStep={4} />);
    expect(screen.getByTestId('production-certificate')).toBeInTheDocument();
  });
});
