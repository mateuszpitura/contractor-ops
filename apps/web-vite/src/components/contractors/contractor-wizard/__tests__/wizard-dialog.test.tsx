/**
 * web-vite port. Tests `WizardDialogView` with a stubbed hook return.
 * Step containers are mocked to avoid tRPC.
 */

import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../step-company.js', () => ({
  StepCompany: () => <div data-testid="step-company">Step Company</div>,
}));

vi.mock('../step-billing.js', () => ({
  StepBilling: () => <div data-testid="step-billing">Step Billing</div>,
}));

vi.mock('../step-assignment.js', () => ({
  StepAssignment: () => <div data-testid="step-assignment">Step Assignment</div>,
}));

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { WizardFormValues } from '../wizard-dialog.js';
import { WizardDialogView } from '../wizard-dialog.js';

function makeT() {
  const dict: Record<string, string> = {
    title: 'Add contractor',
    step1: 'Company details',
    step2: 'Billing',
    step3: 'Assignment',
    next1: 'Next: Billing',
    next2: 'Next: Assignment',
    submit: 'Save contractor',
    back: 'Back',
    close: 'Close',
    discardChanges: 'Discard changes',
    'discardConfirm.title': 'Discard?',
    'discardConfirm.body': 'You have unsaved changes.',
    'discardConfirm.keep': 'Keep',
    'discardConfirm.discard': 'Discard',
  };
  return ((key: string) => dict[key] ?? key) as never;
}

function makeProps(
  overrides: Partial<Parameters<typeof WizardDialogView>[0]> = {},
): Parameters<typeof WizardDialogView>[0] {
  // We need a form, but the view never inspects internals deeply; useForm
  // returns the right shape for register/formState. We construct one inline.
  const formStub = {
    register: () => ({}),
    formState: { errors: {}, isDirty: false },
    watch: () => '',
    setValue: vi.fn(),
    getValues: vi.fn(() => ({})),
    reset: vi.fn(),
  } as unknown as Parameters<typeof WizardDialogView>[0]['form'];

  return {
    open: true,
    t: makeT(),
    form: formStub,
    currentStep: 0,
    stepLabels: ['Company details', 'Billing', 'Assignment'],
    nextLabels: ['Next: Billing', 'Next: Assignment', 'Save contractor'],
    showDiscardDialog: false,
    setShowDiscardDialog: vi.fn(),
    isDirty: false,
    isSubmitting: false,
    handleClose: vi.fn(),
    handleDiscard: vi.fn(),
    handleNext: vi.fn(),
    handleBack: vi.fn(),
    handleDialogOpenChange: vi.fn(),
    ...overrides,
  } as Parameters<typeof WizardDialogView>[0];
}

// Convenience hook-aware variant when we need form internals to behave.
function FormConnected({
  children,
}: {
  children: (form: ReturnType<typeof useForm<WizardFormValues>>) => React.ReactNode;
}) {
  const form = useForm<WizardFormValues>({
    defaultValues: {} as WizardFormValues,
  });
  return <>{children(form)}</>;
}

describe('WizardDialogView', () => {
  it('renders the dialog title', () => {
    render(<WizardDialogView {...makeProps()} />);
    expect(screen.getByText('Add contractor')).toBeInTheDocument();
  });

  it('shows all three step labels in the indicator', () => {
    render(<WizardDialogView {...makeProps()} />);
    expect(screen.getByText('Company details')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Assignment')).toBeInTheDocument();
  });

  it('only renders step 1 content when currentStep=0', () => {
    render(<WizardDialogView {...makeProps()} />);
    expect(screen.getByTestId('step-company')).toBeInTheDocument();
    expect(screen.queryByTestId('step-billing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-assignment')).not.toBeInTheDocument();
  });

  it('renders the Close button when the form is clean', () => {
    render(<WizardDialogView {...makeProps({ isDirty: false })} />);
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByText('Discard changes')).not.toBeInTheDocument();
  });

  it('renders the Discard changes button when the form is dirty', () => {
    render(<WizardDialogView {...makeProps({ isDirty: true })} />);
    expect(screen.getByText('Discard changes')).toBeInTheDocument();
  });

  it('renders the next button label from props', () => {
    render(<WizardDialogView {...makeProps()} />);
    expect(screen.getByText('Next: Billing')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<WizardDialogView {...makeProps({ open: false })} />);
    expect(screen.queryByText('Add contractor')).not.toBeInTheDocument();
  });

  it('does not render a Back button on step 0', () => {
    render(<WizardDialogView {...makeProps()} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('renders the Back button on step > 0', () => {
    render(<WizardDialogView {...makeProps({ currentStep: 1 })} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders the step 2 content slot when currentStep=1', () => {
    render(<WizardDialogView {...makeProps({ currentStep: 1 })} />);
    expect(screen.getByTestId('step-billing')).toBeInTheDocument();
  });

  it('calls handleClose when Close is clicked', async () => {
    const handleClose = vi.fn();
    const { user } = setup(<WizardDialogView {...makeProps({ handleClose })} />);
    await user.click(screen.getByText('Close'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls handleNext when Next is clicked', async () => {
    const handleNext = vi.fn();
    const { user } = setup(<WizardDialogView {...makeProps({ handleNext })} />);
    await user.click(screen.getByText('Next: Billing'));
    expect(handleNext).toHaveBeenCalled();
  });

  it('disables Next while submitting', () => {
    render(<WizardDialogView {...makeProps({ isSubmitting: true })} />);
    const allButtons = screen.getAllByRole('button');
    const submitting = allButtons.find(b => /Save contractor/i.test(b.textContent ?? ''));
    expect(submitting).toBeDisabled();
  });

  // FormConnected helper proves we can wire a real react-hook-form instance
  // through without exploding when the view actually reads .formState.
  it('accepts a real react-hook-form instance via the form prop', () => {
    render(<FormConnected>{form => <WizardDialogView {...makeProps({ form })} />}</FormConnected>);
    expect(screen.getByText('Add contractor')).toBeInTheDocument();
  });
});
