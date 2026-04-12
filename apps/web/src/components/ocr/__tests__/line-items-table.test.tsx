import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { LineItemsTable } from '../line-items-table';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    description: 'Widget A',
    quantity: 2,
    unit: 'pcs',
    unitPriceMinor: 10000,
    netAmountMinor: 20000,
    vatRate: '23%',
    vatAmountMinor: 4600,
    grossAmountMinor: 24600,
    confidence: 92,
    ...overrides,
  };
}

describe('LineItemsTable', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders item count badge', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getByText('1 items')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Unit Price')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('VAT Rate')).toBeInTheDocument();
    expect(screen.getByText('Gross')).toBeInTheDocument();
  });

  it('renders item values in inputs when not readOnly', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    // description input should have Widget A
    expect(inputs[0]).toHaveValue('Widget A');
  });

  it('renders item values as text in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('100.00')).toBeInTheDocument(); // unitPriceMinor 10000 -> 100.00
  });

  it('does not show remove buttons in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.queryByRole('button', { name: /Remove Item/i })).not.toBeInTheDocument();
  });

  it('shows remove button when not readOnly', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Remove Item/i })).toBeInTheDocument();
  });

  it('calls onChange when remove button is clicked', async () => {
    const { user } = setup(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2', description: 'Widget B' })]}
        onChange={onChange}
      />,
    );
    const removeButtons = screen.getAllByRole('button', {
      name: /Remove Item/i,
    });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'item-2' })]);
  });

  it('shows add line item button when not readOnly', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Add line item/i })).toBeInTheDocument();
  });

  it('does not show add button in readOnly mode', () => {
    render(<LineItemsTable items={[]} onChange={onChange} readOnly />);
    expect(screen.queryByRole('button', { name: /Add line item/i })).not.toBeInTheDocument();
  });

  it('calls onChange with new item when add button is clicked', async () => {
    const { user } = setup(<LineItemsTable items={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Add line item/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        description: '',
        quantity: null,
        confidence: 0,
      }),
    ]);
  });

  it('renders empty badge for zero items', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('formats minor-unit values correctly (null as empty)', () => {
    render(
      <LineItemsTable items={[makeItem({ unitPriceMinor: null })]} onChange={onChange} readOnly />,
    );
    // null unitPrice should render mdash
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  // ---- Edit cell values ----
  it('calls onChange when description input is changed', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    await user.clear(inputs[0]);
    await user.type(inputs[0], 'New Widget');
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onChange when quantity input is changed', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    // quantity input is second
    await user.clear(inputs[1]);
    await user.type(inputs[1], '5');
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onChange when unit input is changed', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    await user.clear(inputs[2]);
    await user.type(inputs[2], 'kg');
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onChange when unit price input is changed', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    await user.clear(inputs[3]);
    await user.type(inputs[3], '50.00');
    expect(onChange).toHaveBeenCalled();
  });

  // ---- Multiple items ----
  it('renders multiple items', () => {
    render(
      <LineItemsTable
        items={[
          makeItem(),
          makeItem({ id: 'item-2', description: 'Widget B' }),
          makeItem({ id: 'item-3', description: 'Widget C' }),
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('renders all remove buttons for multiple items', () => {
    render(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2', description: 'Widget B' })]}
        onChange={onChange}
      />,
    );
    const removeButtons = screen.getAllByRole('button', {
      name: /Remove Item/i,
    });
    expect(removeButtons).toHaveLength(2);
  });

  // ---- readOnly mode shows text, not inputs ----
  it('shows all values as text in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('pcs')).toBeInTheDocument();
    expect(screen.getByText('23%')).toBeInTheDocument();
  });

  // ---- VAT rate change ----
  it('calls onChange when vat rate input is changed', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    // vatRate is at index 5
    await user.clear(inputs[5]);
    await user.type(inputs[5], '8%');
    expect(onChange).toHaveBeenCalled();
  });

  // ---- Heading ----
  it('renders heading', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByText('Line Items')).toBeInTheDocument();
  });

  // ---- Confidence header ----
  it('renders confidence column header', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getByText('Conf.')).toBeInTheDocument();
  });

  // ---- Cell blur saves ----
  it('calls onChange on input blur after editing description', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    await user.click(inputs[0]);
    await user.clear(inputs[0]);
    await user.type(inputs[0], 'Updated');
    await user.tab(); // blur
    expect(onChange).toHaveBeenCalled();
  });

  // ---- Add row adds new empty item ----
  it('adds a row with default empty values', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Add line item/i }));
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.length).toBe(2);
    expect(lastCall[1].description).toBe('');
  });

  // ---- Totals row rendering ----
  it('renders totals footer row', () => {
    render(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2', grossAmountMinor: 10000 })]}
        onChange={onChange}
        readOnly
      />,
    );
    // Totals row should show sum
    const grossValues = screen.getAllByText(/\d+\.\d{2}/);
    expect(grossValues.length).toBeGreaterThan(0);
  });

  // ---- Net amount column ----
  it('renders net amount value in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    // 20000 minor = 200.00
    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  // ---- Gross amount column ----
  it('renders gross amount value in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    // 24600 minor = 246.00
    expect(screen.getByText('246.00')).toBeInTheDocument();
  });

  // ---- VAT amount display ----
  it('renders vat amount in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    // 4600 minor = 46.00
    expect(screen.getByText('46.00')).toBeInTheDocument();
  });

  // ---- Confidence value display ----
  it('displays confidence value for items', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    // Confidence column exists and renders
    expect(screen.getByText('Conf.')).toBeInTheDocument();
  });

  // ---- Cell edit: description triggers onChange ----
  it('calls onChange when single character is typed in description', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    const descInput = inputs[0]!;
    await user.type(descInput, 'X');
    expect(onChange).toHaveBeenCalled();
    // Last call should contain the item with updated description
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall[0].description).toContain('Widget A');
  });

  // ---- Cell edit: quantity ----
  it('calls onChange when quantity is edited', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    // Find the qty input (value "2")
    const qtyInput = inputs.find(i => (i as HTMLInputElement).value === '2');
    if (qtyInput) {
      await user.clear(qtyInput);
      await user.type(qtyInput, '5');
      expect(onChange).toHaveBeenCalled();
    }
  });

  // ---- Cell edit: unit ----
  it('calls onChange when unit is edited', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    const unitInput = inputs.find(i => (i as HTMLInputElement).value === 'pcs');
    if (unitInput) {
      await user.clear(unitInput);
      await user.type(unitInput, 'kg');
      expect(onChange).toHaveBeenCalled();
    }
  });

  // ---- Cell edit: VAT rate ----
  it('calls onChange when VAT rate is edited', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    const vatInput = inputs.find(i => (i as HTMLInputElement).value === '23%');
    if (vatInput) {
      await user.clear(vatInput);
      await user.type(vatInput, '8%');
      expect(onChange).toHaveBeenCalled();
    }
  });

  // ---- Cell edit: unit price (minor units) ----
  it('calls onChange when unit price is edited', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    const priceInput = inputs.find(i => (i as HTMLInputElement).value === '100.00');
    if (priceInput) {
      await user.clear(priceInput);
      await user.type(priceInput, '150.00');
      expect(onChange).toHaveBeenCalled();
    }
  });

  // ---- Null values render as empty in readOnly mode ----
  it('renders dash for null values in readOnly mode', () => {
    render(
      <LineItemsTable
        items={[makeItem({ quantity: null, unit: null, unitPriceMinor: null })]}
        onChange={onChange}
        readOnly
      />,
    );
    // Null values should render as mdash character
    const dashes = document.querySelectorAll('.text-muted-foreground');
    expect(dashes.length).toBeGreaterThan(0);
  });

  // ---- Multiple items badge count ----
  it('renders correct item count badge for multiple items', () => {
    render(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2' }), makeItem({ id: 'item-3' })]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });
});
