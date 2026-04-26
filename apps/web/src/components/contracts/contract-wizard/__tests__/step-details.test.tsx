import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { StepDetails } from '../step-details';
import type { ContractWizardFormValues } from '../wizard-dialog';

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      list: {
        queryOptions: vi.fn(() => ({
          queryKey: ['contractor', 'list'],
          queryFn: async () => ({ items: [], total: 0 }),
        })),
      },
    },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      data: {
        items: [
          {
            id: 'ctr-1',
            displayName: 'Acme Contractor',
            taxId: '1234567890',
          },
        ],
      },
      isLoading: false,
    }),
  };
});

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ role: 'admin' }),
}));

vi.mock('@/lib/mask-pii', () => ({
  maskTaxId: (id: string) => `***${id.slice(-4)}`,
  canViewSensitivePii: () => true,
}));

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
  return <StepDetails form={form} contractorId={props.contractorId} />;
}

describe('StepDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders contract title field from wizard copy', () => {
    render(<StepDetailsHarness />);
    expect(screen.getByLabelText(/contract title/i)).toHaveValue('SOW 2025');
  });

  it('locks contractor field when contractorId prop is set', () => {
    render(<StepDetailsHarness contractorId="ctr-locked" />);
    const readOnly = screen.getByDisplayValue('ctr-locked');
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

  it('renders start date and end date picker triggers', () => {
    render(<StepDetailsHarness />);
    const buttons = screen.getAllByRole('button');
    // Start date button should show formatted date since default has startDate
    const dateButtons = buttons.filter(
      b => b.querySelector('svg') !== null && b.className.includes('justify-start'),
    );
    expect(dateButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders notice period input with number type', () => {
    render(<StepDetailsHarness />);
    const noticePeriod = screen.getByLabelText(/notice period/i);
    expect(noticePeriod).toHaveAttribute('type', 'number');
    expect(noticePeriod).toHaveAttribute('min', '1');
  });

  it('shows contractor display name in readonly input when contractorId matches a loaded contractor', () => {
    render(<StepDetailsHarness contractorId="ctr-1" />);
    const readOnly = screen.getByDisplayValue('Acme Contractor');
    expect(readOnly).toHaveAttribute('readonly');
  });

  it('renders contract type select', () => {
    render(<StepDetailsHarness />);
    expect(screen.getByText(/contract type/i)).toBeInTheDocument();
  });
});
