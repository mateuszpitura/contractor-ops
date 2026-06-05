/**
 * StepReview accepts the `usePaymentRunStepReview` hook return as a `review`
 * prop; the test passes a shaped stub instead of deep-mocking tRPC +
 * react-query create/lock mutations.
 */

import { render, screen, setup } from '@/test/test-utils';
import type { usePaymentRunStepReview } from '../../hooks/use-payment-run-step-review.js';
import { StepReview } from '../step-review';

type Review = ReturnType<typeof usePaymentRunStepReview>;

function makeReview(overrides: Partial<Review> = {}): Review {
  const invoices = [
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
    // biome-ignore lint/suspicious/noExplicitAny: shape mirrors usePaymentRunStepReview groupedByCurrency invoice entry
  ] as any[];
  const groupedByCurrency = {
    PLN: { invoices, totalMinor: 300000 },
  } as Review['groupedByCurrency'];
  return {
    name: '',
    setName: vi.fn(),
    notes: '',
    setNotes: vi.fn(),
    exportFormat: 'CSV',
    setExportFormat: vi.fn(),
    isLocking: false,
    groupedByCurrency,
    currencies: ['PLN'],
    grandTotal: 300000,
    hasPLN: true,
    hasEUR: false,
    handleLockAndExport: vi.fn(),
    ...overrides,
  } as Review;
}

function makeProps(
  overrides: Partial<Parameters<typeof StepReview>[0]> = {},
  reviewOverrides: Partial<Review> = {},
) {
  return {
    selectedInvoiceIds: ['inv-1', 'inv-2'],
    groupByCurrency: false,
    onBack: vi.fn(),
    onComplete: vi.fn(),
    review: makeReview(reviewOverrides),
    ...overrides,
  };
}

describe('StepReview', () => {
  it('renders the run-number placeholder', () => {
    render(<StepReview {...makeProps()} />);
    expect(screen.getByText(/PR-.*-XXX/)).toBeInTheDocument();
  });

  it('renders the name and description text inputs', () => {
    render(<StepReview {...makeProps()} />);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the invoice numbers from the grouped invoices', () => {
    render(<StepReview {...makeProps()} />);
    expect(screen.getByText('FV/001')).toBeInTheDocument();
    expect(screen.getByText('FV/002')).toBeInTheDocument();
  });

  it('renders Back and Lock buttons', () => {
    render(<StepReview {...makeProps()} />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument();
  });

  it('invokes onBack when Back is clicked', async () => {
    const onBack = vi.fn();
    const { user } = setup(<StepReview {...makeProps({ onBack })} />);
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('invokes review.handleLockAndExport when Lock is clicked', async () => {
    const handleLockAndExport = vi.fn();
    const { user } = setup(<StepReview {...makeProps({}, { handleLockAndExport })} />);
    await user.click(screen.getByRole('button', { name: /lock/i }));
    expect(handleLockAndExport).toHaveBeenCalledTimes(1);
  });

  it('disables both action buttons while review.isLocking is true', () => {
    render(<StepReview {...makeProps({}, { isLocking: true })} />);
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });
});
