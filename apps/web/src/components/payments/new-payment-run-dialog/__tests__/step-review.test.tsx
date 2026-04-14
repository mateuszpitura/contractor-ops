import { render, screen } from '@/test/test-utils';
import { StepReview } from '../step-review';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: {
        items: [
          {
            id: 'inv-1',
            invoiceNumber: 'FV/001',
            amountToPayMinor: 100000,
            currency: 'PLN',
            contractor: { legalName: 'Acme' },
          },
          {
            id: 'inv-2',
            invoiceNumber: 'FV/002',
            amountToPayMinor: 200000,
            currency: 'PLN',
            contractor: { legalName: 'Beta' },
          },
        ],
      },
    }),
    useMutation: () => ({ mutateAsync: vi.fn() }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    payment: {
      readyForPayment: { queryOptions: () => ({ queryKey: ['payment.ready'] }) },
      create: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
      lockAndExport: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
    },
  },
}));

function makeProps(overrides: Partial<Parameters<typeof StepReview>[0]> = {}) {
  return {
    selectedInvoiceIds: ['inv-1', 'inv-2'],
    groupByCurrency: false,
    onBack: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe('StepReview', () => {
  it('renders run number placeholder', () => {
    render(<StepReview {...makeProps()} />);

    expect(screen.getByText(/PR-.*-XXX/)).toBeInTheDocument();
  });

  it('renders name and description inputs', () => {
    render(<StepReview {...makeProps()} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows selected invoices with amounts', () => {
    render(<StepReview {...makeProps()} />);

    expect(screen.getByText('FV/001')).toBeInTheDocument();
    expect(screen.getByText('FV/002')).toBeInTheDocument();
  });

  it('renders back and lock buttons', () => {
    render(<StepReview {...makeProps()} />);

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const { setup: userSetup } = await import('@/test/test-utils');
    const onBack = vi.fn();
    const { user } = userSetup(<StepReview {...makeProps({ onBack })} />);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
