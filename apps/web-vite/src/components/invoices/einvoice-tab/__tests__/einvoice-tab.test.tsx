import { render, screen } from '@/test/test-utils';

// EInvoiceTab embeds a tRPC-backed download button container — stub it so the
// tab test stays isolated to its own composition logic.
vi.mock('../download-zugferd-pdf-button', () => ({
  DownloadZugferdPdfButton: () => (
    <button type="button" data-testid="zugferd-stub">
      Download ZUGFeRD PDF
    </button>
  ),
}));

import { EInvoiceTabSkeleton, EInvoiceTabView } from '../einvoice-tab';
import type { InvoiceTabData } from '../types';

type TabExtras = {
  errorMessage?: string | null;
  isFinalizePending?: boolean;
  isRevalidatePending?: boolean;
  isSendPending?: boolean;
  isDownloadXmlPending?: boolean;
  isDownloadReportPending?: boolean;
};

function baseData(overrides: Partial<InvoiceTabData> = {}): InvoiceTabData {
  return {
    invoiceId: 'inv_1',
    lifecycle: null,
    peppolParticipant: null,
    receiverAcceptsXRechnungCii: false,
    leitwegIdValue: null,
    leitwegIdSource: null,
    isPublicSectorBuyer: false,
    ...overrides,
  };
}

function tabProps(tabData: InvoiceTabData = baseData(), extras: TabExtras = {}) {
  return {
    tabData,
    errorMessage: extras.errorMessage ?? null,
    isFinalizePending: extras.isFinalizePending ?? false,
    isRevalidatePending: extras.isRevalidatePending ?? false,
    isSendPending: extras.isSendPending ?? false,
    isDownloadXmlPending: extras.isDownloadXmlPending ?? false,
    isDownloadReportPending: extras.isDownloadReportPending ?? false,
    onFinalize: vi.fn(),
    onRevalidate: vi.fn(),
    onSend: vi.fn(),
    onDownloadXml: vi.fn(),
    onDownloadReport: vi.fn(),
  };
}

describe('EInvoiceTab', () => {
  it('emits an aria-live polite announcement region', () => {
    render(<EInvoiceTabView invoiceId="inv_1" {...tabProps()} />);
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('skeleton variant renders without the Generation heading', () => {
    render(<EInvoiceTabSkeleton />);
    expect(screen.queryByRole('heading', { name: 'Generation' })).not.toBeInTheDocument();
  });

  it('renders an error alert when errorMessage is present', () => {
    render(
      <EInvoiceTabView
        invoiceId="inv_1"
        {...tabProps(baseData(), { errorMessage: 'Something went wrong' })}
      />,
    );
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('renders the Leitweg warning when DE public-sector buyer lacks an ID', () => {
    render(
      <EInvoiceTabView
        invoiceId="inv_1"
        {...tabProps(baseData({ isPublicSectorBuyer: true, leitwegIdValue: null }))}
      />,
    );
    expect(
      screen.getByText('Leitweg-ID missing for German public-sector buyer'),
    ).toBeInTheDocument();
  });

  it('renders the resolved Leitweg block when isPublicSectorBuyer + leitwegIdValue are set', () => {
    render(
      <EInvoiceTabView
        invoiceId="inv_1"
        {...tabProps(
          baseData({
            isPublicSectorBuyer: true,
            leitwegIdValue: '991-33333TEST-33',
            leitwegIdSource: 'contract',
          }),
        )}
      />,
    );
    const resolved = document.querySelector('[data-slot=leitweg-id-resolved-inline]');
    expect(resolved?.textContent ?? '').toContain('991-33333TEST-33');
  });
});
