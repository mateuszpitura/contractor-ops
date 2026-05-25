/**
 * Ported from apps/web/src/components/contracts/contract-wizard/__tests__/wizard-dialog.test.tsx.
 *
 * Web-vite split: ContractWizardDialog takes a single `wizard` prop built
 * by `useContractWizardDialog`. Step components are mocked out so we cover
 * only the dialog chrome, indicator, and navigation.
 */

import { useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

vi.mock('../step-details', () => ({
  StepDetails: () => <div data-testid="step-details">Step Details</div>,
}));
vi.mock('../step-financial', () => ({
  StepFinancial: () => <div data-testid="step-financial">Step Financial</div>,
}));
vi.mock('../step-documents', () => ({
  StepDocuments: ({ onSkip }: { onSkip?: () => void }) => (
    <div data-testid="step-documents">
      Step Documents
      <button type="button" data-testid="skip-docs" onClick={onSkip}>
        Skip
      </button>
    </div>
  ),
}));

import type { ContractWizardFormValues } from '../wizard-dialog';
import { ContractWizardDialog } from '../wizard-dialog';

type Wizard = Parameters<typeof ContractWizardDialog>[0]['wizard'];

function StubProvider({
  currentStep = 0,
  stepDetails = {},
  stepDocuments = { files: [], onDrop: vi.fn(), removeFile: vi.fn(), resetFiles: vi.fn() },
  handleNext = vi.fn(),
  handleBack = vi.fn(),
  handleClose = vi.fn(),
  handleDiscard = vi.fn(),
  handleSkipDocuments = vi.fn(),
  isPending = false,
  isDirty = false,
  showDiscardDialog = false,
  setShowDiscardDialog = vi.fn(),
  open = true,
}: Partial<{
  currentStep: number;
  stepDetails: Record<string, unknown>;
  stepDocuments: Wizard['stepDocuments'];
  handleNext: () => void;
  handleBack: () => void;
  handleClose: () => void;
  handleDiscard: () => void;
  handleSkipDocuments: () => void;
  isPending: boolean;
  isDirty: boolean;
  showDiscardDialog: boolean;
  setShowDiscardDialog: (next: boolean) => void;
  open: boolean;
}>) {
  const form = useForm<ContractWizardFormValues>({
    defaultValues: {
      contractorId: '',
      title: '',
      type: 'STATEMENT_OF_WORK',
      startDate: new Date('2025-01-15').toISOString(),
      autoRenewal: false,
      currency: 'PLN',
      billingModel: 'HOURLY',
      rateType: 'PER_HOUR',
    },
  });

  const wizard: Wizard = {
    t: ((key: string) => key) as Wizard['t'],
    form,
    contractorId: undefined,
    currentStep,
    showDiscardDialog,
    setShowDiscardDialog,
    preFilledFields: new Set<string>(),
    stepDetails: stepDetails as Wizard['stepDetails'],
    stepDocuments,
    stepLabels: ['Contract details', 'Financial terms', 'Documents'],
    nextLabels: ['Continue', 'Continue', 'Create contract'],
    isPending,
    isDirty,
    handleClose,
    handleDiscard,
    handleNext,
    handleBack,
    handleSkipDocuments,
  } as unknown as Wizard;

  return <ContractWizardDialog open={open} wizard={wizard} />;
}

describe('ContractWizardDialog', () => {
  it('renders dialog with title and step labels', () => {
    render(<StubProvider />);
    expect(screen.getByText('Contract details')).toBeInTheDocument();
    expect(screen.getByText('Financial terms')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('renders StepDetails on step 0', () => {
    render(<StubProvider currentStep={0} />);
    expect(screen.getByTestId('step-details')).toBeInTheDocument();
    expect(screen.queryByTestId('step-financial')).not.toBeInTheDocument();
  });

  it('renders StepFinancial on step 1', () => {
    render(<StubProvider currentStep={1} />);
    expect(screen.getByTestId('step-financial')).toBeInTheDocument();
    expect(screen.queryByTestId('step-details')).not.toBeInTheDocument();
  });

  it('renders StepDocuments on step 2', () => {
    render(<StubProvider currentStep={2} />);
    expect(screen.getByTestId('step-documents')).toBeInTheDocument();
  });

  it('invokes handleNext when Continue is clicked', async () => {
    const handleNext = vi.fn();
    const { user } = setup(<StubProvider handleNext={handleNext} />);
    await user.click(screen.getByText('Continue'));
    expect(handleNext).toHaveBeenCalled();
  });

  it('renders Back button starting from step 1 and invokes handleBack', async () => {
    const handleBack = vi.fn();
    const { user } = setup(<StubProvider currentStep={1} handleBack={handleBack} />);
    await user.click(screen.getByText('back'));
    expect(handleBack).toHaveBeenCalled();
  });

  it('renders the close CTA on step 0 (calls handleClose)', async () => {
    const handleClose = vi.fn();
    const { user } = setup(<StubProvider currentStep={0} handleClose={handleClose} />);
    await user.click(screen.getByText('close'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('disables the next button when isPending is true', () => {
    render(<StubProvider isPending={true} />);
    const nextBtn = screen.getByText('submit').closest('button') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('renders the discard confirmation when showDiscardDialog is true', () => {
    render(<StubProvider showDiscardDialog={true} />);
    expect(screen.getByText('discardConfirm.title')).toBeInTheDocument();
    expect(screen.getByText('discardConfirm.body')).toBeInTheDocument();
  });

  it('invokes handleSkipDocuments when the Skip control fires', async () => {
    const handleSkipDocuments = vi.fn();
    const { user } = setup(
      <StubProvider currentStep={2} handleSkipDocuments={handleSkipDocuments} />,
    );
    await user.click(screen.getByTestId('skip-docs'));
    expect(handleSkipDocuments).toHaveBeenCalled();
  });
});
