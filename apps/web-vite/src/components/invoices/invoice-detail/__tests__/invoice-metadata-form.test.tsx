import { render, screen, setup, waitFor } from '@/test/test-utils';

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ role: 'admin' }),
}));

// VatRateSelectorContainer reaches into tRPC for tax rates — swap for a
// presentational stub so the form test stays scoped to its own logic.
vi.mock('../../vat-rate-selector-container', () => ({
  VatRateSelectorContainer: () => <div data-testid="vat-rate-selector-stub" />,
}));

import type { useInvoiceMetadataForm } from '../../hooks/use-invoice-metadata-form';
import { InvoiceMetadataForm } from '../invoice-metadata-form';

type Mutations = ReturnType<typeof useInvoiceMetadataForm>;

function baseInvoice(
  overrides: Record<string, unknown> = {},
): Parameters<typeof InvoiceMetadataForm>[0]['invoice'] {
  return {
    id: 'inv-meta-1',
    invoiceNumber: 'FV/META/01',
    issueDate: '2026-01-10',
    dueDate: '2026-02-10',
    servicePeriodStart: null,
    servicePeriodEnd: null,
    sellerTaxId: null,
    subtotalMinor: 10000,
    vatRate: '23',
    vatAmountMinor: 2300,
    totalMinor: 12300,
    withholdingMinor: null,
    amountToPayMinor: 12300,
    currency: 'PLN',
    sellerBankAccount: null,
    status: 'RECEIVED',
    ...overrides,
  } as Parameters<typeof InvoiceMetadataForm>[0]['invoice'];
}

function makeMutations(overrides: Partial<Mutations> = {}): Mutations {
  return {
    onSaveDraft: vi.fn(),
    onSubmitForMatching: vi.fn(),
    onVoid: vi.fn(),
    isSaving: false,
    isSubmittingForMatching: false,
    isVoiding: false,
    isSubmitting: false,
    ...overrides,
  } as Mutations;
}

describe('InvoiceMetadataForm', () => {
  it('enables editing and shows save / submit actions when status is RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} mutations={makeMutations()} />);
    expect(screen.getByLabelText(/invoice number/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for matching/i })).toBeInTheDocument();
  });

  it('disables the invoice-number input and hides save / submit when not RECEIVED', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({ status: 'APPROVED' })}
        mutations={makeMutations()}
      />,
    );
    expect(screen.getByLabelText(/invoice number/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('shows a validation error when invoice number is cleared before save', async () => {
    const onSaveDraft = vi.fn();
    const { user } = setup(
      <InvoiceMetadataForm invoice={baseInvoice()} mutations={makeMutations({ onSaveDraft })} />,
    );
    const numberInput = screen.getByLabelText(/invoice number/i);
    await user.clear(numberInput);
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() =>
      expect(screen.getByText(/invoice number is required/i)).toBeInTheDocument(),
    );
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('calls onSaveDraft with the form values when save draft passes validation', async () => {
    const onSaveDraft = vi.fn();
    const { user } = setup(
      <InvoiceMetadataForm invoice={baseInvoice()} mutations={makeMutations({ onSaveDraft })} />,
    );
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalledTimes(1);
    });
    // react-hook-form passes `(values, event)` — assert just the values arg.
    const callArgs = onSaveDraft.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs).toMatchObject({ invoiceNumber: 'FV/META/01', currency: 'PLN' });
  });

  it('calls onSubmitForMatching when the submit button is used', async () => {
    const onSubmitForMatching = vi.fn();
    const { user } = setup(
      <InvoiceMetadataForm
        invoice={baseInvoice()}
        mutations={makeMutations({ onSubmitForMatching })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /submit for matching/i }));
    await waitFor(() => expect(onSubmitForMatching).toHaveBeenCalledTimes(1));
  });

  it('disables save + submit buttons when isSubmitting', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice()}
        mutations={makeMutations({ isSubmitting: true, isSaving: true })}
      />,
    );
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /submit for matching/i })).toBeDisabled();
  });

  it('renders all currency input labels for monetary fields', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} mutations={makeMutations()} />);
    expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vat amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gross amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/withholding/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount to pay/i)).toBeInTheDocument();
  });

  it('converts minor units to display value for monetary fields', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({ subtotalMinor: 25050, totalMinor: 50000 })}
        mutations={makeMutations()}
      />,
    );
    expect(screen.getByLabelText(/net amount/i)).toHaveValue('250.50');
    expect(screen.getByLabelText(/gross amount/i)).toHaveValue('500.00');
  });

  it('renders the more-actions trigger when status is RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} mutations={makeMutations()} />);
    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
  });
});
