import { render, screen } from '@/test/test-utils';
import { StepSelect } from '../step-select';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    payment: {
      readyForPayment: { queryOptions: () => ({ queryKey: ['payment.ready'] }) },
    },
  },
}));

function makeProps(overrides: Partial<Parameters<typeof StepSelect>[0]> = {}) {
  return {
    selectedInvoiceIds: [],
    onSelectionChange: vi.fn(),
    groupByCurrency: false,
    onGroupByCurrencyChange: vi.fn(),
    onCancel: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

describe('StepSelect', () => {
  it('renders empty state when no invoices', () => {
    render(<StepSelect {...makeProps()} />);

    expect(screen.getByText('No approved invoices')).toBeInTheDocument();
  });

  it('renders currency filter and search input', () => {
    render(<StepSelect {...makeProps()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('cancel button works', async () => {
    const { setup: userSetup } = await import('@/test/test-utils');
    const onCancel = vi.fn();
    const { user } = userSetup(<StepSelect {...makeProps({ onCancel })} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('next button is disabled when no invoices selected', () => {
    render(<StepSelect {...makeProps()} />);

    const nextBtn = screen.getByRole('button', { name: /review/i });
    expect(nextBtn).toBeDisabled();
  });

  it('next button is enabled when invoices are selected', () => {
    render(<StepSelect {...makeProps({ selectedInvoiceIds: ['inv-1'] })} />);

    const nextBtn = screen.getByRole('button', { name: /review/i });
    expect(nextBtn).toBeEnabled();
  });
});
