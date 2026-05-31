/**
 * Mirror of contractors/contractor-table/__tests__/data-table-bulk-actions.test.tsx.
 * The invoice bar exposes Submit-for-matching + Void (destructive confirm dialog);
 * tRPC mutations are wired in `useInvoiceBulkActions` and injected via props here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { InvoiceBulkActionsHandlers } from '../../hooks/use-invoice-bulk-actions.js';
import type { InvoiceRow } from '../columns.js';
import { DataTableBulkActions } from '../data-table-bulk-actions.js';

function makeSelectedRows(selectedCount: number): InvoiceRow[] {
  return Array.from(
    { length: selectedCount },
    (_, i) => ({ id: `inv-${i}` }) as InvoiceRow,
  );
}

function makeBulkActions(
  overrides: Partial<InvoiceBulkActionsHandlers> = {},
): InvoiceBulkActionsHandlers {
  return {
    onBulkSubmitForMatching: vi.fn(),
    onBulkVoid: vi.fn(),
    isSubmittingForMatching: false,
    isVoiding: false,
    ...overrides,
  };
}

function renderActions(selectedCount: number, bulkActions = makeBulkActions()) {
  return render(
    <DataTableBulkActions
      selectedRows={makeSelectedRows(selectedCount)}
      bulkActions={bulkActions}
      onComplete={vi.fn()}
    />,
  );
}

describe('Invoice DataTableBulkActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no rows selected', () => {
    const { container } = renderActions(0);
    expect(container.innerHTML).toBe('');
  });

  it('renders Submit for matching and Void buttons when rows are selected', () => {
    renderActions(2);
    expect(screen.getByText('Submit for matching')).toBeInTheDocument();
    expect(screen.getByText('Void')).toBeInTheDocument();
  });

  it('wraps actions in a styled container', () => {
    const { container } = renderActions(2);
    const toolbar = container.querySelector('.rounded-lg.border');
    expect(toolbar).toBeInTheDocument();
  });

  it('clicking Submit for matching fires onBulkSubmitForMatching with selected ids', async () => {
    const bulkActions = makeBulkActions();
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        bulkActions={bulkActions}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Submit for matching'));
    expect(bulkActions.onBulkSubmitForMatching).toHaveBeenCalledWith(['inv-0', 'inv-1']);
  });

  it('Void button has destructive text styling', () => {
    renderActions(2);
    const voidBtn = screen.getByText('Void').closest('button');
    expect(voidBtn?.className).toContain('text-destructive');
  });

  it('clicking Void opens the confirmation dialog', async () => {
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(3)}
        bulkActions={makeBulkActions()}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Void'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('confirming void in the dialog dispatches onBulkVoid', async () => {
    const bulkActions = makeBulkActions();
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        bulkActions={bulkActions}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Void'));
    await screen.findByRole('alertdialog');
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find(
      b => /^Void/i.test(b.textContent ?? '') && b.textContent !== 'Void',
    );
    expect(confirmBtn).toBeTruthy();
    if (confirmBtn) await user.click(confirmBtn);
    expect(bulkActions.onBulkVoid).toHaveBeenCalledWith(['inv-0', 'inv-1']);
  });
});
