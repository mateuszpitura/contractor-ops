/**
 * EN strings sourced from `apps/web-vite/messages/en.json#OcrReview.lineItems`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '../../../test/test-utils.js';
import { LineItemsTable } from '../line-items-table.js';

interface LineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceMinor: number | null;
  netAmountMinor: number | null;
  vatRate: string | null;
  vatAmountMinor: number | null;
  grossAmountMinor: number | null;
  confidence: number;
}

function makeItem(overrides: Partial<LineItem> = {}): LineItem {
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

describe('LineItemsTable (web-vite)', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
  });

  it('renders the items-count badge', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getByText('1 items')).toBeInTheDocument();
  });

  it('renders the column headers', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    for (const h of ['Description', 'Qty', 'Unit', 'Unit Price', 'Net', 'VAT Rate', 'Gross']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it('binds item values into inline inputs in edit mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    expect((inputs[0] as HTMLInputElement).value).toBe('Widget A');
  });

  it('renders item values as text in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('100.00')).toBeInTheDocument();
  });

  it('hides remove buttons in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.queryByRole('button', { name: /Remove Item/i })).not.toBeInTheDocument();
  });

  it('renders a remove button per row in edit mode', () => {
    render(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2', description: 'Widget B' })]}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('button', { name: /Remove Item/i })).toHaveLength(2);
  });

  it('removes the targeted row when remove is clicked', async () => {
    const { user } = setup(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'item-2', description: 'Widget B' })]}
        onChange={onChange}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: /Remove Item/i });
    await user.click(buttons[0]);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'item-2' })]);
  });

  it('renders the add-line-item button when not readOnly', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Add line item/i })).toBeInTheDocument();
  });

  it('hides the add button in readOnly mode', () => {
    render(<LineItemsTable items={[]} onChange={onChange} readOnly />);
    expect(screen.queryByRole('button', { name: /Add line item/i })).not.toBeInTheDocument();
  });

  it('appends a default empty item when add is clicked', async () => {
    const { user } = setup(<LineItemsTable items={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Add line item/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ description: '', quantity: null, confidence: 0 }),
    ]);
  });

  it('renders "0 items" when the list is empty', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('renders all displayable values in readOnly mode', () => {
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} readOnly />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('pcs')).toBeInTheDocument();
    expect(screen.getByText('23%')).toBeInTheDocument();
    expect(screen.getByText('200.00')).toBeInTheDocument();
    expect(screen.getByText('246.00')).toBeInTheDocument();
    expect(screen.getByText('46.00')).toBeInTheDocument();
  });

  it('renders the heading and confidence header', () => {
    render(<LineItemsTable items={[]} onChange={onChange} />);
    expect(screen.getByText('Line Items')).toBeInTheDocument();
    render(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    expect(screen.getAllByText('Conf.').length).toBeGreaterThan(0);
  });

  it('emits onChange when an inline input is typed into', async () => {
    const { user } = setup(<LineItemsTable items={[makeItem()]} onChange={onChange} />);
    const desc = screen.getAllByRole('textbox')[0];
    await user.type(desc, 'X');
    expect(onChange).toHaveBeenCalled();
  });
});
