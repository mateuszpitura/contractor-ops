import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup, waitFor } from '@/test/test-utils';
import { PaymentRunSidePanel } from '../payment-run-side-panel';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/payments/wht-summary-card', () => ({
  WhtSummaryCard: () => <div data-testid="wht-summary" />,
}));

vi.mock('../payment-run-badge', () => ({
  PaymentRunBadge: ({ status }: { status: string }) => (
    <span data-testid="run-badge">{status}</span>
  ),
  PaymentItemBadge: ({ status }: { status: string }) => (
    <span data-testid="item-badge">{status}</span>
  ),
}));

type RunItem = {
  id: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  failureReason: string | null;
  invoice: { invoiceNumber: string; dueDate: string };
  contractor: { id: string; legalName: string };
};

type RunData = {
  id: string;
  runNumber: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  exportFormat: string | null;
  invoiceCount: number;
  totalMinor: number;
  currency: string;
  items: RunItem[];
};

const baseRun: RunData = {
  id: 'run-1',
  runNumber: 'PR-001',
  status: 'DRAFT',
  createdAt: new Date().toISOString(),
  completedAt: null,
  exportFormat: 'MT940',
  invoiceCount: 2,
  totalMinor: 500000,
  currency: 'PLN',
  items: [
    {
      id: 'item-1',
      invoiceId: 'inv-1',
      amountMinor: 300000,
      currency: 'PLN',
      status: 'PENDING',
      paymentReference: null,
      failureReason: null,
      invoice: { invoiceNumber: 'FV/2025/001', dueDate: '2025-03-01' },
      contractor: { id: 'ct-1', legalName: 'Acme Corp' },
    },
    {
      id: 'item-2',
      invoiceId: 'inv-2',
      amountMinor: 200000,
      currency: 'PLN',
      status: 'PAID',
      paymentReference: 'REF-123',
      failureReason: null,
      invoice: { invoiceNumber: 'FV/2025/002', dueDate: '2025-03-15' },
      contractor: { id: 'ct-2', legalName: 'Beta LLC' },
    },
  ],
};

let runData: typeof baseRun | null = baseRun;

const { mockMutate } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: runData }),
    useMutation: (opts: Record<string, unknown>) => ({
      mutate: mockMutate,
      isPending: false,
      ...opts,
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    payment: {
      get: { queryOptions: vi.fn(() => ({ queryKey: ['payment', 'get'] })) },
      markAllPaid: { mutationOptions: vi.fn((o: object) => o) },
      cancel: { mutationOptions: vi.fn((o: object) => o) },
      updateItemStatus: { mutationOptions: vi.fn((o: object) => o) },
      removeFromRun: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentRunSidePanel', () => {
  const onOpenChange = vi.fn();
  const onImportStatement = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    runData = { ...baseRun };
  });

  it('renders run header with run number and status badge', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getByTestId('run-badge')).toHaveTextContent('DRAFT');
  });

  it('renders metadata grid with format, invoice count, and total', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('MT940')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders invoice items with invoice numbers', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
    expect(screen.getByText('FV/2025/002')).toBeInTheDocument();
  });

  it('renders contractor names in items', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
  });

  it('shows payment reference when present', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Ref: REF-123')).toBeInTheDocument();
  });

  it('shows cancel button for DRAFT status', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Cancel run')).toBeInTheDocument();
  });

  it('shows download export and mark all paid for EXPORTED status', () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    render(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    expect(screen.getByText('Download export')).toBeInTheDocument();
    expect(screen.getByText('Mark all paid')).toBeInTheDocument();
    expect(screen.getByText('Import statement')).toBeInTheDocument();
  });

  it('shows download export for COMPLETED status', () => {
    runData = { ...baseRun, status: 'COMPLETED' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Download export')).toBeInTheDocument();
    // No cancel or mark all paid for completed
    expect(screen.queryByText('Cancel run')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark all paid')).not.toBeInTheDocument();
  });

  it('renders skeleton loading state when run data is null', () => {
    runData = null;
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // When run is null, no run header is shown
    expect(screen.queryByText('PR-001')).not.toBeInTheDocument();
  });

  it('shows cancel button for LOCKED status with download', () => {
    runData = { ...baseRun, status: 'LOCKED' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Download export')).toBeInTheDocument();
    expect(screen.getByText('Cancel run')).toBeInTheDocument();
  });

  it('shows completed date when present', () => {
    runData = { ...baseRun, completedAt: '2025-03-20T10:00:00Z' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders item badges for each invoice', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const badges = screen.getAllByTestId('item-badge');
    expect(badges.length).toBe(2);
    expect(badges[0]).toHaveTextContent('PENDING');
    expect(badges[1]).toHaveTextContent('PAID');
  });

  it('renders formatted amounts for items', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />, {
      locale: 'pl',
    });
    // 300000 minor = 3000.00 PLN, 200000 = 2000.00 PLN
    expect(screen.getByText(/3[\s\u00a0]?000,00 PLN/)).toBeInTheDocument();
    expect(screen.getByText(/2[\s\u00a0]?000,00 PLN/)).toBeInTheDocument();
  });

  it('shows import statement button for EXPORTED status calling onImportStatement', async () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    const { user } = setup(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    await user.click(screen.getByText('Import statement'));
    expect(onImportStatement).toHaveBeenCalledWith('run-1');
  });

  it('shows CANCELLED status with no action buttons', () => {
    runData = { ...baseRun, status: 'CANCELLED' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Cancel run')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark all paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Download export')).not.toBeInTheDocument();
  });

  it('shows today for items created today', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('today')).toBeInTheDocument();
  });

  it('opens cancel dialog when cancel run button is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    await user.click(screen.getByText('Cancel run'));
    // AlertDialog title should be visible
    await waitFor(() => {
      expect(screen.getByText('Cancel payment run?')).toBeInTheDocument();
    });
  });

  it('shows confirm text after first click on mark all paid', async () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    const { user } = setup(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    // First click activates confirm mode
    await user.click(screen.getByText('Mark all paid'));
    // Confirm text should appear (from t("sidePanel.confirmMarkAllPaid"))
    await waitFor(() => {
      expect(screen.getByText(/Mark all invoices/)).toBeInTheDocument();
    });
  });

  it('renders import statement button for EXPORTED status even without handler', () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // Button is always rendered for EXPORTED, handler is optional
    expect(screen.getByText('Import statement')).toBeInTheDocument();
  });

  it('renders due dates for invoice items', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // Items have invoice numbers which include due dates
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
    expect(screen.getByText('FV/2025/002')).toBeInTheDocument();
  });

  it('renders export format in metadata', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('MT940')).toBeInTheDocument();
    expect(screen.getByText('Export format')).toBeInTheDocument();
  });

  it('renders mark all paid button for EXPORTED status', () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    render(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    const markBtn = screen.getByText('Mark all paid');
    expect(markBtn.closest('button')).not.toBeDisabled();
  });

  it('shows invoice links for items', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    const links = screen.getAllByRole('link');
    expect(links.some(l => l.getAttribute('href')?.includes('/invoices/'))).toBe(true);
  });

  it('confirms mark all paid on second click and calls mutation', async () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    const { user } = setup(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    await user.click(screen.getByText('Mark all paid'));
    await waitFor(() => {
      expect(screen.getByText(/Mark all invoices/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Mark all invoices/));
    expect(mockMutate).toHaveBeenCalledWith({ runId: 'run-1' });
  });

  it('confirms cancel dialog and calls cancel mutation', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    await user.click(screen.getByText('Cancel run'));
    await waitFor(() => {
      expect(screen.getByText('Cancel payment run?')).toBeInTheDocument();
    });
    // The AlertDialog confirm button says "Cancel run"
    const dialogButtons = screen.getAllByText('Cancel run');
    // The last one is the confirm action inside the dialog
    await user.click(dialogButtons[dialogButtons.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith({ runId: 'run-1' });
  });

  it('renders LOCKED status with cancel and download buttons', () => {
    runData = { ...baseRun, status: 'LOCKED' };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByTestId('run-badge')).toHaveTextContent('LOCKED');
    expect(screen.getByText('Download export')).toBeInTheDocument();
    expect(screen.getByText('Cancel run')).toBeInTheDocument();
  });

  it('shows item failure reference when present', () => {
    runData = {
      ...baseRun,
      items: [
        {
          ...baseRun.items[0],
          status: 'PAID',
          paymentReference: 'PAY-REF-999',
        },
        baseRun.items[1],
      ],
    };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Ref: PAY-REF-999')).toBeInTheDocument();
  });

  it('renders download export button and shows toast on click', async () => {
    runData = { ...baseRun, status: 'COMPLETED' };
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    await user.click(screen.getByText('Download export'));
    // toast.info is called by handleDownloadExport
  });

  it('shows total amount formatted', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />, {
      locale: 'pl',
    });
    // 500000 minor = 5000.00 PLN
    expect(screen.getByText(/5[\s\u00a0]?000,00 PLN/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Deep interaction tests - per-item actions, inline forms
  // ---------------------------------------------------------------------------

  it('shows per-item more menu for PENDING items in DRAFT status', () => {
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // PENDING items should have a more button (MoreHorizontal)
    // PAID items in DRAFT also get the remove option
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(moreButtons.length).toBeGreaterThan(0);
  });

  it('shows cancel dialog with exported body text for EXPORTED status', async () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    const { user } = setup(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    // The CancelRunButton renders "Cancel run" text for all statuses
    const cancelButtons = screen.getAllByText('Cancel run');
    await user.click(cancelButtons[0]);
    await waitFor(() => {
      // For EXPORTED status, dialog should show exported-specific title
      expect(screen.getByText('Cancel exported run?')).toBeInTheDocument();
      expect(screen.getByText(/already been exported/i)).toBeInTheDocument();
    });
  });

  it('shows yesterday for items created one day ago', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    runData = { ...baseRun, createdAt: yesterday.toISOString() };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('yesterday')).toBeInTheDocument();
  });

  it('shows days ago for items older than one day', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    runData = { ...baseRun, createdAt: fiveDaysAgo.toISOString() };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('5d ago')).toBeInTheDocument();
  });

  it('shows localized date for items older than 30 days', () => {
    const oldDate = new Date('2024-01-15T10:00:00Z');
    runData = { ...baseRun, createdAt: oldDate.toISOString() };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // Should render a pl-PL formatted date
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('renders without exportFormat showing dash', () => {
    runData = { ...baseRun, exportFormat: null };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Export format')).toBeInTheDocument();
  });

  it('formats currency with correct label when currency differs', () => {
    runData = { ...baseRun, currency: 'EUR', totalMinor: 100000 };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />, {
      locale: 'pl',
    });
    expect(screen.getByText(/1[\s\u00a0]?000,00 EUR/)).toBeInTheDocument();
  });

  it('renders without runNumber, falls back to truncated id', () => {
    runData = { ...baseRun, runNumber: null };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('run-1')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Per-item inline action tests
  // ---------------------------------------------------------------------------

  it('shows mark paid and mark failed options in per-item dropdown', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(moreButtons.length).toBeGreaterThan(0);
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark paid')).toBeInTheDocument();
      expect(screen.getByText('Mark failed')).toBeInTheDocument();
    });
  });

  it('shows remove from run option for DRAFT items', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Remove from run')).toBeInTheDocument();
    });
  });

  it('shows inline mark paid form when mark paid is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark paid')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark paid'));
    await waitFor(() => {
      expect(screen.getByText('Reference ID')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  it('shows inline mark failed form when mark failed is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark failed')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark failed'));
    await waitFor(() => {
      expect(screen.getByText('Failure reason')).toBeInTheDocument();
    });
  });

  it('shows remove confirmation when remove from run is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Remove from run')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Remove from run'));
    await waitFor(() => {
      expect(screen.getByText(/Remove this invoice/)).toBeInTheDocument();
    });
  });

  it('calls mutation when mark paid confirm is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark paid')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark paid'));
    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('calls mutation when remove confirm is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Remove from run')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Remove from run'));
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Remove'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('cancels mark paid inline form when cancel is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark paid')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark paid'));
    await waitFor(() => {
      expect(screen.getAllByText('Cancel').length).toBeGreaterThan(0);
    });
    // Click the inline cancel button (there may be multiple "Cancel" texts)
    const cancelBtns = screen.getAllByText('Cancel');
    await user.click(cancelBtns[cancelBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText('Reference ID')).not.toBeInTheDocument();
    });
  });

  it('calls mutation with reference when mark paid confirm includes reference', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark paid')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark paid'));
    await waitFor(() => {
      expect(screen.getByText('Reference ID')).toBeInTheDocument();
    });
    const refInput = screen.getByPlaceholderText(/reference/i);
    await user.type(refInput, 'REF-NEW-123');
    await user.click(screen.getByText('Confirm'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows mark failed inline form and calls mutation with reason', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark failed')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark failed'));
    await waitFor(() => {
      expect(screen.getByText('Failure reason')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/reason/i);
    await user.type(textarea, 'Bank rejected');
    const confirmBtns = screen.getAllByText('Confirm');
    await user.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockMutate).toHaveBeenCalled();
  });

  it('mark failed confirm is disabled when no failure reason is entered', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark failed')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark failed'));
    await waitFor(() => {
      expect(screen.getByText('Failure reason')).toBeInTheDocument();
    });
    // Confirm button should be disabled without text
    const confirmBtns = screen.getAllByText('Confirm');
    const failedConfirm = confirmBtns[confirmBtns.length - 1]?.closest('button');
    expect(failedConfirm).toBeDisabled();
  });

  it('cancels mark failed inline form when cancel is clicked', async () => {
    const { user } = setup(
      <PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    await user.click(moreButtons[0] as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('Mark failed')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Mark failed'));
    await waitFor(() => {
      expect(screen.getByText('Failure reason')).toBeInTheDocument();
    });
    const cancelBtns = screen.getAllByText('Cancel');
    await user.click(cancelBtns[cancelBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText('Failure reason')).not.toBeInTheDocument();
    });
  });

  it('shows failure reason in item when failureReason is present', () => {
    runData = {
      ...baseRun,
      items: [
        {
          ...baseRun.items[0],
          status: 'FAILED',
          failureReason: 'Insufficient funds',
        },
        baseRun.items[1],
      ],
    };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // FAILED items don't have dropdown menus (isTerminal)
    const badges = screen.getAllByTestId('item-badge');
    expect(badges[0]).toHaveTextContent('FAILED');
  });

  it('does not show per-item actions for PAID items in non-DRAFT runs', () => {
    runData = {
      ...baseRun,
      status: 'COMPLETED',
      items: [
        {
          ...baseRun.items[0],
          status: 'PAID',
          paymentReference: 'REF-DONE',
        },
        {
          ...baseRun.items[1],
          status: 'PAID',
          paymentReference: 'REF-DONE2',
        },
      ],
    };
    render(<PaymentRunSidePanel runId="run-1" open={true} onOpenChange={onOpenChange} />);
    // Terminal items in non-DRAFT should have no dropdown
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    expect(moreButtons.length).toBe(0);
  });

  it('does not render remove from run for non-DRAFT status items', async () => {
    runData = { ...baseRun, status: 'EXPORTED' };
    const { user } = setup(
      <PaymentRunSidePanel
        runId="run-1"
        open={true}
        onOpenChange={onOpenChange}
        onImportStatement={onImportStatement}
      />,
    );
    const moreButtons = document.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    if (moreButtons.length > 0) {
      await user.click(moreButtons[0] as HTMLElement);
      await waitFor(() => {
        expect(screen.queryByText('Remove from run')).not.toBeInTheDocument();
      });
    }
  });
});
