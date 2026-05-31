/**
 * Ported from apps/web/src/components/contracts/contract-table/__tests__/data-table-bulk-actions.test.tsx.
 *
 * Web-vite split: DataTableBulkActions takes `table`, `bulkActions` (handlers
 * bag from `useContractBulkActions`), and `onComplete`. Mutations are not
 * triggered here so we pass a no-op handlers bag.
 */

import { vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { DataTableBulkActions } from '../data-table-bulk-actions';

function makeSelectedRows(selectedCount: number) {
  return Array.from({ length: selectedCount }, (_, i) => ({ id: `ct${i}` })) as never;
}

const noopHandlers = {
  onBulkTerminate: vi.fn(),
  isTerminating: false,
};

describe('DataTableBulkActions (contracts)', () => {
  it('returns null when no rows selected', () => {
    const { container } = render(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(0)}
        bulkActions={noopHandlers}
        onComplete={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons when rows are selected', () => {
    render(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        bulkActions={noopHandlers}
        onComplete={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders the selected-count text', () => {
    render(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(3)}
        bulkActions={noopHandlers}
        onComplete={vi.fn()}
      />,
    );
    // The i18n key Contracts.bulkActions.selected interpolates {count}.
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
