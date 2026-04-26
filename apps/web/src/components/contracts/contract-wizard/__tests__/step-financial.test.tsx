import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { StepFinancial } from '../step-financial';
import type { ContractWizardFormValues } from '../wizard-dialog';

function FinancialHarness(props: { preFilledFields?: Set<string> }) {
  const form = useForm<ContractWizardFormValues>({
    defaultValues: {
      contractorId: 'clcontractor000000000001',
      title: 'SOW — Platform',
      type: 'STATEMENT_OF_WORK',
      startDate: '2026-01-01',
      currency: 'PLN',
      billingModel: 'HOURLY',
      rateType: 'PER_HOUR',
      rateValueMinor: 15000,
      paymentTermsDays: 14,
      invoiceCycle: 'MONTHLY',
    },
  });

  return <StepFinancial form={form} preFilledFields={props.preFilledFields} />;
}

describe('StepFinancial', () => {
  it('renders financial field labels from translations', () => {
    render(<FinancialHarness />);

    expect(screen.getByLabelText(/^Rate$/i)).toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    expect(screen.getByText('Billing cycle')).toBeInTheDocument();
    expect(screen.getByText('Rate type')).toBeInTheDocument();
  });

  it('shows pre-filled hint when rate field was pre-filled', () => {
    render(<FinancialHarness preFilledFields={new Set(['rateValueMinor'])} />);

    expect(screen.getByText(/Pre-filled from contractor billing profile/i)).toBeInTheDocument();
  });

  it('does not show pre-filled hint when preFilledFields is not provided', () => {
    render(<FinancialHarness />);
    expect(
      screen.queryByText(/Pre-filled from contractor billing profile/i),
    ).not.toBeInTheDocument();
  });

  it('shows pre-filled hint for currency when currency is pre-filled', () => {
    render(<FinancialHarness preFilledFields={new Set(['currency'])} />);
    const hints = screen.getAllByText(/Pre-filled from contractor billing profile/i);
    expect(hints.length).toBeGreaterThanOrEqual(1);
  });

  it('shows pre-filled hint for billingModel when pre-filled', () => {
    render(<FinancialHarness preFilledFields={new Set(['billingModel'])} />);
    expect(screen.getByText(/Pre-filled from contractor billing profile/i)).toBeInTheDocument();
  });

  it('renders rate input with initial value converted from minor units', () => {
    render(<FinancialHarness />);
    const rateInput = screen.getByLabelText(/^Rate$/i);
    // 15000 minor units = 150.00
    expect(rateInput).toHaveValue(150);
  });

  it('renders payment terms input with number type', () => {
    render(<FinancialHarness />);
    const paymentTerms = screen.getByLabelText(/payment terms/i);
    expect(paymentTerms).toHaveAttribute('type', 'number');
  });

  it('displays currency suffix next to rate input', () => {
    render(<FinancialHarness />);
    const plnElements = screen.getAllByText('PLN');
    expect(plnElements.length).toBeGreaterThanOrEqual(1);
  });
});
