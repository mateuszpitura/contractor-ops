/**
 * web-vite port. View takes `users`, `bulkActions`, `onComplete` as injected
 * props. TemplatePickerContainer is tRPC-bound so we mock it.
 *
 * i18next-icu doesn't expand bare `{count}` placeholders for the selection
 * label, so assertions key on per-button copy or container shape instead of
 * the raw "{count} selected" string.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../workflows/template-picker-container.js', () => ({
  TemplatePickerContainer: () => null,
}));

import { render, screen, setup, waitFor } from '../../../../test/test-utils.js';
import type { ContractorBulkActionsHandlers } from '../../hooks/use-contractor-bulk-actions.js';
import type { ContractorRow } from '../columns.js';
import { DataTableBulkActions } from '../data-table-bulk-actions.js';

function makeSelectedRows(selectedCount: number): ContractorRow[] {
  return Array.from({ length: selectedCount }, (_, i) => ({ id: `c${i}` }) as ContractorRow);
}

function makeBulkActions(
  overrides: Partial<ContractorBulkActionsHandlers> = {},
): ContractorBulkActionsHandlers {
  return {
    onBulkArchive: vi.fn(),
    onBulkAssignOwner: vi.fn(),
    onExport: vi.fn(),
    isArchiving: false,
    isAssigningOwner: false,
    isExporting: false,
    ...overrides,
  };
}

const sampleUsers = [
  { id: 'u1', userId: 'u1', name: 'Alice', email: 'alice@test.com' },
  { id: 'u2', userId: 'u2', name: 'Bob', email: 'bob@test.com' },
];

function renderActions(selectedCount: number, bulkActions = makeBulkActions()) {
  return render(
    <DataTableBulkActions
      selectedRows={makeSelectedRows(selectedCount)}
      users={sampleUsers as never}
      bulkActions={bulkActions}
      onComplete={vi.fn()}
    />,
  );
}

describe('DataTableBulkActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no rows selected', () => {
    const { container } = renderActions(0);
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons when rows are selected', () => {
    renderActions(3);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders the four primary action buttons', () => {
    renderActions(2);
    expect(screen.getByText('Assign owner')).toBeInTheDocument();
    expect(screen.getByText('Export contractors')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Launch workflow')).toBeInTheDocument();
  });

  it('opens archive confirmation dialog on archive click', async () => {
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(3)}
        users={sampleUsers as never}
        bulkActions={makeBulkActions()}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Archive'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('archive dialog has a Cancel button', async () => {
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(3)}
        users={sampleUsers as never}
        bulkActions={makeBulkActions()}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Archive'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('archive button has destructive text styling', () => {
    renderActions(2);
    const archiveBtn = screen.getByText('Archive').closest('button');
    expect(archiveBtn?.className).toContain('text-destructive');
  });

  it('opens export dropdown with CSV + XLSX entries', async () => {
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        users={sampleUsers as never}
        bulkActions={makeBulkActions()}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('selecting CSV export invokes bulkActions.onExport with "csv"', async () => {
    const bulkActions = makeBulkActions();
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        users={sampleUsers as never}
        bulkActions={bulkActions}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-slot="dropdown-menu-item"]').length,
      ).toBeGreaterThanOrEqual(2);
    });
    const items = Array.from(document.querySelectorAll('[data-slot="dropdown-menu-item"]'));
    const csvItem = items.find(el => /csv/i.test(el.textContent ?? ''));
    if (csvItem) await user.click(csvItem as HTMLElement);
    expect(bulkActions.onExport).toHaveBeenCalledWith(['c0', 'c1'], 'csv');
  });

  it('opens assign-owner popover listing supplied users', async () => {
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        users={sampleUsers as never}
        bulkActions={makeBulkActions()}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('clicking a user fires onBulkAssignOwner', async () => {
    const bulkActions = makeBulkActions();
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        users={sampleUsers as never}
        bulkActions={bulkActions}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Alice'));
    expect(bulkActions.onBulkAssignOwner).toHaveBeenCalledWith(['c0', 'c1'], 'u1');
  });

  it('confirming archive in the dialog dispatches onBulkArchive', async () => {
    const bulkActions = makeBulkActions();
    const { user } = setup(
      <DataTableBulkActions
        selectedRows={makeSelectedRows(2)}
        users={sampleUsers as never}
        bulkActions={bulkActions}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Archive'));
    await screen.findByRole('alertdialog');
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find(
      b => /^Archive/i.test(b.textContent ?? '') && b.textContent !== 'Archive',
    );
    expect(confirmBtn).toBeTruthy();
    if (confirmBtn) await user.click(confirmBtn);
    expect(bulkActions.onBulkArchive).toHaveBeenCalledWith(['c0', 'c1']);
  });

  it('wraps actions in a styled container', () => {
    const { container } = renderActions(2);
    const toolbar = container.querySelector('.rounded-lg.border');
    expect(toolbar).toBeInTheDocument();
  });
});
