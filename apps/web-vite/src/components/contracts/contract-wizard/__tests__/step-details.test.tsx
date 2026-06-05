/**
 * StepDetails takes contractors data + handlers as props. Use a local
 * harness that mounts a real react-hook-form and supplies stub contractors.
 */

import { useForm } from 'react-hook-form';
import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('../../../../hooks/use-permissions', () => ({
  usePermissions: () => ({ role: 'admin' }),
}));
vi.mock('../../../../lib/mask-pii', () => ({
  maskTaxId: (id: string) => `***${id.slice(-4)}`,
  canViewSensitivePii: () => true,
}));

import type { ContractorListItem } from '../../hooks/use-contract-wizard-step-details';
import { StepDetails } from '../step-details';
import type { ContractWizardFormValues } from '../wizard-dialog';

const sampleContractors: ContractorListItem[] = [
  { id: 'ctr-1', displayName: 'Acme Contractor', taxId: '1234567890' },
];

function StepDetailsHarness(props: { contractorId?: string }) {
  const form = useForm<ContractWizardFormValues>({
    defaultValues: {
      contractorId: '',
      title: 'SOW 2025',
      type: 'STATEMENT_OF_WORK',
      startDate: new Date('2025-01-15').toISOString(),
      endDate: undefined,
      noticePeriodDays: undefined,
      autoRenewal: false,
      currency: 'PLN',
      billingModel: 'HOURLY',
      rateType: 'PER_HOUR',
      rateValueMinor: 0,
      paymentTermsDays: 14,
      invoiceCycle: 'MONTHLY',
    },
  });
  return (
    <StepDetails
      form={form}
      contractorId={props.contractorId}
      contractorSearch=""
      contractors={sampleContractors}
      contractorsLoading={false}
      selectedContractor={sampleContractors.find(c => c.id === props.contractorId)}
      selectedContractorId={props.contractorId}
      setContractorSearch={vi.fn()}
    />
  );
}

describe('StepDetails', () => {
  it('renders contract title input pre-filled', () => {
    render(<StepDetailsHarness />);
    expect(screen.getByLabelText(/contract title/i)).toHaveValue('SOW 2025');
  });

  it('locks contractor field when contractorId is set to a known contractor', () => {
    render(<StepDetailsHarness contractorId="ctr-1" />);
    const readOnly = screen.getByDisplayValue('Acme Contractor');
    expect(readOnly).toHaveAttribute('readonly');
  });

  it('renders contractor picker combobox when contractorId is not provided', () => {
    render(<StepDetailsHarness />);
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders auto-renewal checkbox', () => {
    render(<StepDetailsHarness />);
    const checkbox = screen.getByRole('checkbox', { name: /auto-renewal/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders notice period input with number type and min=1', () => {
    render(<StepDetailsHarness />);
    const noticePeriod = screen.getByLabelText(/notice period/i);
    expect(noticePeriod).toHaveAttribute('type', 'number');
    expect(noticePeriod).toHaveAttribute('min', '1');
  });

  it('renders contract type label', () => {
    render(<StepDetailsHarness />);
    expect(screen.getByText(/contract type/i)).toBeInTheDocument();
  });
});
