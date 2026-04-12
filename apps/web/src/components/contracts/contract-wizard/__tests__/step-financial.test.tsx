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
});
