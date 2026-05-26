/**
 * Web-vite split: PaymentRunSidePanel renders only the loaded variant —
 * the loading skeleton sibling (`PaymentRunSidePanelSkeleton`) and the
 * `showBacsPreview` derivation now live in `PaymentRunSidePanelContainer`.
 * Test injects a stubbed loaded panel (run guaranteed non-null) plus the
 * resolved `showBacsPreview` flag. Container subtrees that still hit
 * tRPC are mocked to inert stubs.
 */

vi.mock('../wht-summary-card-container', () => ({
  WhtSummaryCardContainer: () => null,
}));
vi.mock('../bacs/bacs-preview-card-container', () => ({
  BacsPreviewCardContainer: () => null,
}));
vi.mock('../run/skonto-apply-checkbox-container', () => ({
  SkontoApplyCheckboxContainer: () => null,
}));

import { render, screen, setup } from '@/test/test-utils';
import type { usePaymentRunSidePanel } from '../hooks/use-payment-run-side-panel.js';
import { PaymentRunSidePanel, PaymentRunSidePanelSkeleton } from '../payment-run-side-panel';

type Panel = ReturnType<typeof usePaymentRunSidePanel>;
type LoadedRun = NonNullable<Panel['run']>;
type LoadedPanel = Omit<Panel, 'run'> & { run: LoadedRun };

const t = (key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  return `${key}:${JSON.stringify(vars)}`;
};

const baseItems = [
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
];

function makeRun(overrides: Partial<Record<string, unknown>> = {}): LoadedRun {
  return {
    id: 'run-1',
    runNumber: 'PR-001',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    completedAt: null,
    exportFormat: 'MT940',
    invoiceCount: 2,
    totalMinor: 500000,
    currency: 'PLN',
    items: baseItems,
    ...overrides,
  } as unknown as LoadedRun;
}

function makePanel(overrides: Partial<LoadedPanel> = {}): LoadedPanel {
  const base: LoadedPanel = {
    run: makeRun(),
    items: baseItems,
    status: 'DRAFT',
    safeRunId: 'run-1',
    isLoading: false,
    detectedFormatCounts: [] as [string, number][],
    showFormatHint: false,
    confirmMarkAll: false,
    handleMarkAllPaid: vi.fn(),
    handleDownloadExport: vi.fn(),
    onCancelRun: vi.fn(),
    onUpdateItemStatus: vi.fn(),
    onRemoveFromRun: vi.fn(),
    isMarkAllPaidPending: false,
    isCancelPending: false,
    isUpdatingItem: false,
    isRemovingItem: false,
  } as unknown as LoadedPanel;
  return { ...base, ...overrides } as LoadedPanel;
}

function renderPanel(
  panelOverrides: Partial<LoadedPanel> = {},
  props: Partial<Parameters<typeof PaymentRunSidePanel>[0]> = {},
) {
  const panel = makePanel(panelOverrides);
  const onOpenChange = vi.fn();
  const onImportStatement = vi.fn();
  const formatDate = (v: Date | string) => String(v ?? '');
  const result = render(
    <PaymentRunSidePanel
      open
      onOpenChange={onOpenChange}
      onImportStatement={onImportStatement}
      panel={panel}
      showBacsPreview={false}
      t={t}
      locale="en"
      formatDate={formatDate}
      skontoEnabled={false}
      {...props}
    />,
  );
  return { ...result, panel, onOpenChange, onImportStatement };
}

describe('PaymentRunSidePanelSkeleton', () => {
  it('renders sheet chrome and skeleton rows when open', () => {
    render(<PaymentRunSidePanelSkeleton open onOpenChange={vi.fn()} />);
    // SheetHeader/SheetTitle chrome preserved (sr-only label so layout slot is stable)
    expect(document.querySelector('[data-slot="sheet-title"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders nothing when closed', () => {
    render(<PaymentRunSidePanelSkeleton open={false} onOpenChange={vi.fn()} />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });
});

describe('PaymentRunSidePanel', () => {
  it('renders run number when present', () => {
    renderPanel();
    expect(screen.getByText('PR-001')).toBeInTheDocument();
  });

  it('falls back to truncated run id when runNumber is null', () => {
    renderPanel({ run: makeRun({ runNumber: null, id: 'abcd1234efgh' }) });
    expect(screen.getByText('abcd1234')).toBeInTheDocument();
  });

  it('renders DRAFT cancel button for DRAFT status', () => {
    renderPanel();
    expect(screen.getByText('sidePanel.cancelRun')).toBeInTheDocument();
  });

  it('renders Download export + Mark all paid for EXPORTED status', () => {
    renderPanel({
      status: 'EXPORTED',
      run: makeRun({ status: 'EXPORTED' }),
    });
    expect(screen.getByText('sidePanel.downloadExport')).toBeInTheDocument();
    expect(screen.getByText('sidePanel.markAllPaid')).toBeInTheDocument();
    expect(screen.getByText('sidePanel.importStatement')).toBeInTheDocument();
  });

  it('shows only Download export for COMPLETED status (no cancel / mark-all)', () => {
    renderPanel({
      status: 'COMPLETED',
      run: makeRun({ status: 'COMPLETED' }),
    });
    expect(screen.getByText('sidePanel.downloadExport')).toBeInTheDocument();
    expect(screen.queryByText('sidePanel.cancelRun')).not.toBeInTheDocument();
    expect(screen.queryByText('sidePanel.markAllPaid')).not.toBeInTheDocument();
  });

  it('shows cancel + download for LOCKED status', () => {
    renderPanel({
      status: 'LOCKED',
      run: makeRun({ status: 'LOCKED' }),
    });
    expect(screen.getByText('sidePanel.downloadExport')).toBeInTheDocument();
    expect(screen.getByText('sidePanel.cancelRun')).toBeInTheDocument();
  });

  it('renders no action buttons for CANCELLED status', () => {
    renderPanel({
      status: 'CANCELLED',
      run: makeRun({ status: 'CANCELLED' }),
    });
    expect(screen.queryByText('sidePanel.cancelRun')).not.toBeInTheDocument();
    expect(screen.queryByText('sidePanel.downloadExport')).not.toBeInTheDocument();
    expect(screen.queryByText('sidePanel.markAllPaid')).not.toBeInTheDocument();
  });

  it('invokes onImportStatement with safeRunId when import button is clicked', async () => {
    const onImportStatement = vi.fn();
    const { user } = setup(
      <PaymentRunSidePanel
        open
        onOpenChange={vi.fn()}
        onImportStatement={onImportStatement}
        panel={makePanel({
          status: 'EXPORTED',
          run: makeRun({ status: 'EXPORTED' }),
        })}
        showBacsPreview={false}
        t={t}
        locale="en"
        formatDate={(v: Date | string) => String(v ?? '')}
        skontoEnabled={false}
      />,
    );
    await user.click(screen.getByText('sidePanel.importStatement'));
    expect(onImportStatement).toHaveBeenCalledWith('run-1');
  });

  it('invokes panel.handleDownloadExport when download button is clicked', async () => {
    const handleDownloadExport = vi.fn();
    const panel = makePanel({
      status: 'COMPLETED',
      handleDownloadExport,
      run: makeRun({ status: 'COMPLETED' }),
    });
    const { user } = setup(
      <PaymentRunSidePanel
        open
        onOpenChange={vi.fn()}
        panel={panel}
        showBacsPreview={false}
        t={t}
        locale="en"
        formatDate={(v: Date | string) => String(v ?? '')}
        skontoEnabled={false}
      />,
    );
    await user.click(screen.getByText('sidePanel.downloadExport'));
    expect(handleDownloadExport).toHaveBeenCalled();
  });

  it('invokes panel.handleMarkAllPaid when mark-all-paid button is clicked', async () => {
    const handleMarkAllPaid = vi.fn();
    const panel = makePanel({
      status: 'EXPORTED',
      handleMarkAllPaid,
      run: makeRun({ status: 'EXPORTED' }),
    });
    const { user } = setup(
      <PaymentRunSidePanel
        open
        onOpenChange={vi.fn()}
        onImportStatement={vi.fn()}
        panel={panel}
        showBacsPreview={false}
        t={t}
        locale="en"
        formatDate={(v: Date | string) => String(v ?? '')}
        skontoEnabled={false}
      />,
    );
    await user.click(screen.getByText('sidePanel.markAllPaid'));
    expect(handleMarkAllPaid).toHaveBeenCalled();
  });

  it('renders the confirm label for mark-all-paid when panel.confirmMarkAll is true', () => {
    renderPanel({
      status: 'EXPORTED',
      confirmMarkAll: true,
      run: makeRun({ status: 'EXPORTED' }),
    });
    expect(screen.getByText('sidePanel.confirmMarkAllPaid')).toBeInTheDocument();
  });

  it('renders detected format hint when panel.showFormatHint is true', () => {
    renderPanel({
      showFormatHint: true,
      detectedFormatCounts: [['SEPA_XML', 3]],
    });
    expect(screen.getByText('sidePanel.detectedFormatTitle')).toBeInTheDocument();
    expect(screen.getByText('SEPA_XML')).toBeInTheDocument();
  });

  it('renders an item row per panel.items entry', () => {
    renderPanel();
    expect(screen.getByText('FV/2025/001')).toBeInTheDocument();
    expect(screen.getByText('FV/2025/002')).toBeInTheDocument();
  });
});
