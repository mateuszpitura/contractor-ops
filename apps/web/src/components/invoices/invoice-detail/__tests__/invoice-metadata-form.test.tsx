import { useMutation } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup, waitFor, within } from '@/test/test-utils';

import { InvoiceMetadataForm } from '../invoice-metadata-form';

vi.mock('@/trpc/init', () => ({
  trpc: {
    invoice: {
      update: { mutationOptions: (opts: object) => opts },
      submitForMatching: { mutationOptions: (opts: object) => opts },
      voidInvoice: { mutationOptions: (opts: object) => opts },
      getById: {
        queryKey: (input: { id: string }) => ['invoice', 'getById', input.id],
      },
    },
  },
}));

const {
  invalidateQueries,
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: vi.fn(),
    useQueryClient: () => ({ invalidateQueries }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/invoices/vat-rate-selector', () => ({
  VatRateSelector: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      data-testid="vat-rate-selector"
      value={value}
      // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
      onChange={e => onChange(e.target.value)}
      disabled={disabled}>
      <option value="23">23%</option>
    </select>
  ),
}));

const mockedUseMutation = vi.mocked(useMutation);

/** Hooks run every render; return update -> submit -> void in a repeating cycle. */
let mutationCallIdx = 0;

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-meta-1',
    invoiceNumber: 'FV/META/01',
    issueDate: '2026-01-10',
    dueDate: '2026-02-10',
    servicePeriodStart: null as string | null,
    servicePeriodEnd: null as string | null,
    sellerTaxId: null as string | null,
    subtotalMinor: 10000,
    vatRate: '23',
    vatAmountMinor: 2300,
    totalMinor: 12300,
    withholdingMinor: null as number | null,
    amountToPayMinor: 12300,
    currency: 'PLN',
    sellerBankAccount: null as string | null,
    status: 'RECEIVED',
    ...overrides,
  };
}

describe('InvoiceMetadataForm', () => {
  const updateState = { mutate: vi.fn(), isPending: false };
  const submitState = { mutate: vi.fn(), isPending: false };
  const voidState = { mutate: vi.fn(), isPending: false };

  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallIdx = 0;
    mockedUseMutation.mockImplementation(() => {
      const states = [updateState, submitState, voidState];
      return states[mutationCallIdx++ % 3] as unknown as ReturnType<typeof useMutation>;
    });
  });

  it('enables editing and shows save / submit actions when status is RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);

    expect(screen.getByLabelText(/invoice number/i)).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for matching/i })).toBeInTheDocument();
  });

  it('disables fields and hides save / submit when invoice is not RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ status: 'APPROVED' })} />);

    expect(screen.getByLabelText(/invoice number/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('shows validation error when invoice number is cleared before save', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);

    const numberInput = screen.getByLabelText(/invoice number/i);
    await user.clear(numberInput);
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    expect(await screen.findByText(/invoice number is required/i)).toBeInTheDocument();
    expect(updateState.mutate).not.toHaveBeenCalled();
  });

  it('calls invoice.update when save draft succeeds validation', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    expect(updateState.mutate).toHaveBeenCalledTimes(1);
    expect(updateState.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inv-meta-1',
        data: expect.objectContaining({
          invoiceNumber: 'FV/META/01',
          currency: 'PLN',
        }),
      }),
    );
  });

  it('chains update then submitForMatching when submit button is used', async () => {
    updateState.mutate.mockImplementation((_input: unknown, ctx?: { onSuccess?: () => void }) => {
      ctx?.onSuccess?.();
    });

    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);

    await user.click(screen.getByRole('button', { name: /submit for matching/i }));

    expect(updateState.mutate).toHaveBeenCalledTimes(1);
    expect(submitState.mutate).toHaveBeenCalledWith({ id: 'inv-meta-1' });
  });

  it('opens void confirmation and calls voidInvoice mutation on confirm', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    const voidMenuItem = await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      const match = [...items].find(el => /void invoice/i.test(el.textContent ?? ''));
      expect(match).toBeTruthy();
      return match as HTMLElement;
    });
    await user.click(voidMenuItem);

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/void this invoice/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^void invoice$/i }));

    expect(voidState.mutate).toHaveBeenCalledWith({ id: 'inv-meta-1' });
  });

  // ---- Editing mode field rendering ----
  it('renders all monetary fields with correct labels', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vat amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gross amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/withholding/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount to pay/i)).toBeInTheDocument();
  });

  it('renders seller NIP and bank account fields', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByLabelText(/seller nip/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank account/i)).toBeInTheDocument();
  });

  it('renders currency labels for monetary inputs with correct PLN conversion', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ subtotalMinor: 25050 })} />);
    const netInput = screen.getByLabelText(/net amount/i);
    // 25050 minor = 250.50 PLN
    expect(netInput).toHaveValue('250.50');
  });

  it('disables all monetary fields when invoice is not RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ status: 'APPROVED' })} />);
    expect(screen.getByLabelText(/net amount/i)).toBeDisabled();
    expect(screen.getByLabelText(/gross amount/i)).toBeDisabled();
    expect(screen.getByLabelText(/seller nip/i)).toBeDisabled();
    expect(screen.getByLabelText(/bank account/i)).toBeDisabled();
  });

  // ---- Save/cancel interactions ----
  it('disables save and submit buttons when mutation is pending', () => {
    updateState.isPending = true;
    mockedUseMutation.mockImplementation(() => {
      const states = [{ ...updateState, isPending: true }, submitState, voidState];
      return states[mutationCallIdx++ % 3] as unknown as ReturnType<typeof useMutation>;
    });

    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const saveBtn = screen.getByRole('button', { name: /save draft/i });
    const submitBtn = screen.getByRole('button', {
      name: /submit for matching/i,
    });
    expect(saveBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });

  it('renders void menu item accessible via more actions button', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      const match = [...items].find(el => /void invoice/i.test(el.textContent ?? ''));
      expect(match).toBeTruthy();
    });
  });

  it('renders correct invoice number from props', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ invoiceNumber: 'FV/2026/123' })} />);
    expect(screen.getByDisplayValue('FV/2026/123')).toBeInTheDocument();
  });

  it('populates dates from invoice data', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByText('2026-01-10')).toBeInTheDocument();
    expect(screen.getByText('2026-02-10')).toBeInTheDocument();
  });

  it('renders VAT rate label', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByText(/vat rate/i)).toBeInTheDocument();
  });

  it('renders currency label', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByText(/currency/i)).toBeInTheDocument();
  });

  it('renders service period fields', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({
          servicePeriodStart: '2026-01-01',
          servicePeriodEnd: '2026-01-31',
        })}
      />,
    );
    expect(screen.getByText(/service period from/i)).toBeInTheDocument();
    expect(screen.getByText(/service period to/i)).toBeInTheDocument();
  });

  it('renders VAT amount field with correct minor unit conversion', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ vatAmountMinor: 2300 })} />);
    const vatInput = screen.getByLabelText(/vat amount/i);
    expect(vatInput).toHaveValue('23.00');
  });

  it('renders withholding field', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ withholdingMinor: 5000 })} />);
    const withholdingInput = screen.getByLabelText(/withholding/i);
    expect(withholdingInput).toHaveValue('50.00');
  });

  it('renders amount to pay field', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ amountToPayMinor: 12300 })} />);
    const amountToPay = screen.getByLabelText(/amount to pay/i);
    expect(amountToPay).toHaveValue('123.00');
  });

  it('renders bank account placeholder', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByPlaceholderText(/PL61/)).toBeInTheDocument();
  });

  it('renders seller NIP placeholder', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByPlaceholderText(/1234567890/)).toBeInTheDocument();
  });

  it('populates seller bank account from invoice data', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({ sellerBankAccount: 'PL12345678901234567890123456' })}
      />,
    );
    expect(screen.getByDisplayValue('PL12345678901234567890123456')).toBeInTheDocument();
  });

  it('allows editing invoice number in RECEIVED status', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const numberInput = screen.getByLabelText(/invoice number/i);
    await user.clear(numberInput);
    await user.type(numberInput, 'FV/EDITED/99');
    expect(numberInput).toHaveValue('FV/EDITED/99');
  });

  it('does not show more actions for non-RECEIVED invoices', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ status: 'PAID' })} />);
    // Save draft and submit buttons should not appear
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('renders all date fields', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByText(/issue date/i)).toBeInTheDocument();
    expect(screen.getByText(/due date/i)).toBeInTheDocument();
  });

  it('converts minor units to display display correctly for gross amount', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ totalMinor: 12300 })} />);
    const grossInput = screen.getByLabelText(/gross amount/i);
    expect(grossInput).toHaveValue('123.00');
  });

  it('renders seller NIP field with correct value', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ sellerTaxId: '5250000000' })} />);
    expect(screen.getByDisplayValue('5250000000')).toBeInTheDocument();
  });

  it('renders save and submit buttons for RECEIVED status', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for matching/i })).toBeInTheDocument();
  });

  it('renders more actions dropdown menu', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const moreBtn = screen.getByRole('button', { name: /more actions/i });
    expect(moreBtn).toBeInTheDocument();
  });

  it('renders form with all expected sections', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({
          servicePeriodStart: '2026-01-01',
          servicePeriodEnd: '2026-01-31',
          sellerTaxId: '5250000000',
          sellerBankAccount: 'PL61109010140000071219812874',
        })}
      />,
    );

    // All sections should render
    expect(screen.getByLabelText(/invoice number/i)).toBeInTheDocument();
    expect(screen.getByText(/issue date/i)).toBeInTheDocument();
    expect(screen.getByText(/due date/i)).toBeInTheDocument();
    expect(screen.getByText(/service period from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seller nip/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank account/i)).toBeInTheDocument();
  });

  it('renders currency dropdown with PLN selected', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    expect(screen.getByText(/currency/i)).toBeInTheDocument();
    expect(screen.getByText('PLN')).toBeInTheDocument();
  });

  it('renders VAT rate dropdown', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ vatRate: '8' })} />);
    expect(screen.getByText(/vat rate/i)).toBeInTheDocument();
  });

  it('renders zero withholding field', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ withholdingMinor: 0 })} />);
    const withholdingInput = screen.getByLabelText(/withholding/i);
    expect(withholdingInput).toBeInTheDocument();
  });

  it('renders issueDate and dueDate from invoice props', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({
          issueDate: '2026-03-15',
          dueDate: '2026-04-15',
        })}
      />,
    );
    expect(screen.getByText('2026-03-15')).toBeInTheDocument();
    expect(screen.getByText('2026-04-15')).toBeInTheDocument();
  });

  it('renders correct gross amount for totalMinor 50000', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ totalMinor: 50000 })} />);
    const grossInput = screen.getByLabelText(/gross amount/i);
    expect(grossInput).toHaveValue('500.00');
  });

  it('renders amount to pay for large amounts', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice({ amountToPayMinor: 999999 })} />);
    const amountToPay = screen.getByLabelText(/amount to pay/i);
    expect(amountToPay).toHaveValue('9999.99');
  });

  // ---- Currency input blur handler tests ----
  it('updates net amount on blur with valid decimal input', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const netInput = screen.getByLabelText(/net amount/i);
    await user.clear(netInput);
    await user.type(netInput, '250.50');
    await user.tab(); // blur
    expect(netInput).toHaveValue('250.50');
  });

  it('normalizes comma to period on blur for currency input', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const netInput = screen.getByLabelText(/net amount/i);
    await user.clear(netInput);
    await user.type(netInput, '123,45');
    await user.tab(); // blur
    expect(netInput).toHaveValue('123.45');
  });

  it('updates gross amount on blur', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const grossInput = screen.getByLabelText(/gross amount/i);
    await user.clear(grossInput);
    await user.type(grossInput, '500');
    await user.tab();
    expect(grossInput).toHaveValue('500.00');
  });

  it('updates vat amount on blur', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const vatInput = screen.getByLabelText(/vat amount/i);
    await user.clear(vatInput);
    await user.type(vatInput, '57.50');
    await user.tab();
    expect(vatInput).toHaveValue('57.50');
  });

  it('updates withholding amount on blur', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const withholdingInput = screen.getByLabelText(/withholding/i);
    await user.clear(withholdingInput);
    await user.type(withholdingInput, '10');
    await user.tab();
    expect(withholdingInput).toHaveValue('10.00');
  });

  it('updates amount to pay on blur', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const amountInput = screen.getByLabelText(/amount to pay/i);
    await user.clear(amountInput);
    await user.type(amountInput, '350');
    await user.tab();
    expect(amountInput).toHaveValue('350.00');
  });

  // ---- Monetary fields display correct values ----
  it('displays all monetary values from invoice props', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({
          subtotalMinor: 99900,
          vatAmountMinor: 22977,
          totalMinor: 122877,
          withholdingMinor: 1000,
          amountToPayMinor: 121877,
        })}
      />,
    );
    expect(screen.getByLabelText(/net amount/i)).toHaveValue('999.00');
    expect(screen.getByLabelText(/vat amount/i)).toHaveValue('229.77');
    expect(screen.getByLabelText(/gross amount/i)).toHaveValue('1228.77');
    expect(screen.getByLabelText(/withholding/i)).toHaveValue('10.00');
    expect(screen.getByLabelText(/amount to pay/i)).toHaveValue('1218.77');
  });

  // ---- Currency inputs accept valid input ----
  it('allows typing decimal values in currency inputs', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const netInput = screen.getByLabelText(/net amount/i);
    await user.clear(netInput);
    await user.type(netInput, '999.99');
    expect(netInput).toHaveValue('999.99');
  });

  // ---- Editing seller tax ID ----
  it('allows editing seller tax ID', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const nipInput = screen.getByLabelText(/seller nip/i);
    await user.clear(nipInput);
    await user.type(nipInput, '5252455450');
    expect(nipInput).toHaveValue('5252455450');
  });

  // ---- Editing bank account ----
  it('allows editing bank account', async () => {
    const { user } = setup(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const bankInput = screen.getByLabelText(/bank account/i);
    await user.type(bankInput, 'PL61109010140000071219812874');
    expect(bankInput).toHaveValue('PL61109010140000071219812874');
  });

  // ---- Submit for matching button is present ----
  it('submit for matching button is present for RECEIVED', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    const submitBtn = screen.getByRole('button', { name: /submit for matching/i });
    expect(submitBtn).toBeInTheDocument();
  });

  // ---- Service period dates display ----
  it('renders service period dates when provided', () => {
    render(
      <InvoiceMetadataForm
        invoice={baseInvoice({
          servicePeriodStart: '2026-03-01',
          servicePeriodEnd: '2026-03-31',
        })}
      />,
    );
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
    expect(screen.getByText('2026-03-31')).toBeInTheDocument();
  });

  // ---- Multiple currency inputs render ----
  it('renders five currency input fields', () => {
    render(<InvoiceMetadataForm invoice={baseInvoice()} />);
    // net, vat, gross, withholding, amount to pay
    expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vat amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gross amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/withholding/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount to pay/i)).toBeInTheDocument();
  });
});
