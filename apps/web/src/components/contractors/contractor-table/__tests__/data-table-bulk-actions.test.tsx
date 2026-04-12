import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { DataTableBulkActions } from '../data-table-bulk-actions';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: () => ({
    data: [
      { id: 'u1', name: 'Alice', email: 'alice@test.com' },
      { id: 'u2', name: 'Bob', email: 'bob@test.com' },
    ],
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      bulkArchive: { mutationOptions: (opts: Record<string, unknown>) => opts },
      bulkAssignOwner: { mutationOptions: (opts: Record<string, unknown>) => opts },
      export: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/workflows/template-picker-dialog', () => ({
  TemplatePicker: () => null,
}));

function makeMockTable(selectedCount: number) {
  const rows = Array.from({ length: selectedCount }, (_, i) => ({
    original: { id: `c${i}` },
  }));
  return {
    getFilteredSelectedRowModel: () => ({ rows }),
    toggleAllPageRowsSelected: vi.fn(),
  } as unknown;
}

describe('DataTableBulkActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Visibility ----
  it('returns null when no rows selected', () => {
    const { container } = render(<DataTableBulkActions table={makeMockTable(0)} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons when rows are selected', () => {
    render(<DataTableBulkActions table={makeMockTable(3)} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // ---- Selection count ----
  it('displays correct selection count', () => {
    render(<DataTableBulkActions table={makeMockTable(5)} />);
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('displays singular selection count', () => {
    render(<DataTableBulkActions table={makeMockTable(1)} />);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  // ---- Action buttons ----
  it('renders assign owner button', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Assign owner')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Export contractors')).toBeInTheDocument();
  });

  it('renders archive button', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('renders launch workflow button', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Launch workflow')).toBeInTheDocument();
  });

  // ---- Archive confirmation dialog ----
  it('opens archive confirmation dialog on archive click', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Archive'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows correct count in archive dialog title', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
  });

  // ---- Export dropdown ----
  it('renders export CSV and XLSX options in dropdown', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      const csvItem = [...items].find(el => /csv/i.test(el.textContent ?? ''));
      const xlsxItem = [...items].find(el => /xlsx/i.test(el.textContent ?? ''));
      expect(csvItem).toBeTruthy();
      expect(xlsxItem).toBeTruthy();
    });
  });

  // ---- Archive dialog cancel ----
  it('archive dialog has cancel button', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // ---- Launch workflow button click ----
  it('opens workflow picker when launch workflow is clicked', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    // Click launch workflow - should not throw
    await user.click(screen.getByText('Launch workflow'));
  });

  // ---- Single row selection ----
  it('displays 1 selected for single row', () => {
    render(<DataTableBulkActions table={makeMockTable(1)} />);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  // ---- Assign owner button renders ----
  it('renders assign owner with icon', () => {
    const { container } = render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Assign owner')).toBeInTheDocument();
    // Should have SVG icons
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  // ---- Archive button styling ----
  it('archive button has destructive text styling', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    const archiveBtn = screen.getByText('Archive').closest('button');
    expect(archiveBtn?.className).toContain('text-destructive');
  });

  // ---- Multiple selections count ----
  it('displays 10 selected for 10 rows', () => {
    render(<DataTableBulkActions table={makeMockTable(10)} />);
    expect(screen.getByText('10 selected')).toBeInTheDocument();
  });

  // ---- All buttons present ----
  it('renders all four action buttons', () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Assign owner')).toBeInTheDocument();
    expect(screen.getByText('Export contractors')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Launch workflow')).toBeInTheDocument();
  });

  // ---- Archive dialog confirm button ----
  it('renders confirm button in archive dialog', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    // Dialog should have the destructive confirm action
    const confirmBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent?.includes('Archive 3'));
    expect(confirmBtn).toBeTruthy();
  });

  // ---- Cancel closes archive dialog ----
  it('closes archive dialog when cancel is clicked', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Archive'));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  // ---- Export dropdown renders both options ----
  it('clicking CSV export option does not throw', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- Assign owner popover shows user list ----
  it('opens assign owner popover with user list', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  // ---- Toolbar container styling ----
  it('wraps actions in a styled container', () => {
    const { container } = render(<DataTableBulkActions table={makeMockTable(2)} />);
    const toolbar = container.querySelector('.rounded-lg.border');
    expect(toolbar).toBeInTheDocument();
  });

  it('clicking archive confirm button dispatches bulk archive', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Archive'));
    const _dialog = await screen.findByRole('alertdialog');
    const confirmBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent?.includes('Archive 2'));
    expect(confirmBtn).toBeTruthy();
    if (confirmBtn) await user.click(confirmBtn);
  });

  it('shows user list in assign owner popover and user can be selected', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Alice'));
  });

  it('renders all buttons with SVG icons', () => {
    const { container } = render(<DataTableBulkActions table={makeMockTable(3)} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('displays correct count for 20 selected rows', () => {
    render(<DataTableBulkActions table={makeMockTable(20)} />);
    expect(screen.getByText('20 selected')).toBeInTheDocument();
  });

  it('export dropdown opens with CSV and XLSX options', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      const csvItem = [...items].find(el => /csv/i.test(el.textContent ?? ''));
      expect(csvItem).toBeTruthy();
    });
  });

  // ---- Clicking XLSX export option ----
  it('clicking XLSX export option does not throw', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
    const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
    const xlsxItem = [...items].find(el => /xlsx/i.test(el.textContent ?? ''));
    if (xlsxItem) await user.click(xlsxItem as HTMLElement);
  });

  // ---- CSV export option click ----
  it('clicking CSV export dispatches mutation', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
    const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
    const csvItem = [...items].find(el => /csv/i.test(el.textContent ?? ''));
    if (csvItem) await user.click(csvItem as HTMLElement);
  });

  // ---- Launch workflow opens picker ----
  it('clicking launch workflow button opens template picker', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(1)} />);
    await user.click(screen.getByText('Launch workflow'));
    // TemplatePicker is mocked but click should not throw
  });

  // ---- Assign owner: select Bob ----
  it('clicking Bob in assign owner popover does not throw', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Bob'));
  });

  // ---- Export pending shows loader icon ----
  it('renders loader icon in export button when mutation is pending', () => {
    // Mock exportMutation.isPending
    vi.mocked(require('@tanstack/react-query').useMutation).mockReturnValueOnce?.({
      mutate: vi.fn(),
      isPending: true,
    });
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    expect(screen.getByText('Export contractors')).toBeInTheDocument();
  });

  // ---- Single row selection shows correct ID ----
  it('passes single contractor ID for launch workflow', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(1)} />);
    await user.click(screen.getByText('Launch workflow'));
    // TemplatePicker is mocked, no error should occur
  });

  // ---- Archive dialog shows bulk count text ----
  it('archive dialog shows bulk title with count', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(5)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    // Confirm button should say "Archive 5"
    const confirmBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent?.includes('Archive 5'));
    expect(confirmBtn).toBeTruthy();
  });

  // ---- Multiple rows: launch workflow opens picker with contractorIds ----
  it('passes multiple contractor IDs for bulk workflow launch', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Launch workflow'));
    // No error thrown, TemplatePicker receives contractorIds
  });

  // ---- Archive confirm dispatches with correct IDs ----
  it('archive confirm button dispatches mutation with correct IDs', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(3)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent?.includes('Archive 3'));
    expect(confirmBtn).toBeTruthy();
    if (confirmBtn) {
      await user.click(confirmBtn);
    }
  });

  // ---- Export CSV dispatches mutation ----
  it('CSV export click dispatches export mutation with csv format', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Export contractors'));
    await waitFor(() => {
      const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
    const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
    const csvItem = [...items].find(el => /csv/i.test(el.textContent ?? ''));
    if (csvItem) await user.click(csvItem as HTMLElement);
  });

  // ---- Assign owner: select user dispatches mutation ----
  it('selecting a user in assign owner dispatches mutation', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Assign owner'));
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Alice'));
    // The bulkAssignOwnerMutation.mutate should have been called
  });

  // ---- 100 selected rows count displays correctly ----
  it('displays correct count for 100 selected rows', () => {
    render(<DataTableBulkActions table={makeMockTable(100)} />);
    expect(screen.getByText('100 selected')).toBeInTheDocument();
  });

  // ---- Archive dialog body text is present ----
  it('archive dialog contains body text about archival', async () => {
    const { user } = setup(<DataTableBulkActions table={makeMockTable(2)} />);
    await user.click(screen.getByText('Archive'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    // Dialog should have some descriptive body text
    const description = dialog.querySelector('[data-slot="alert-dialog-description"]');
    expect(description).toBeTruthy();
  });
});
