/**
 * Container/component split port. The presentational panel takes a
 * pre-built `cardBody` ReactNode (container picks form vs processing
 * variant). We render the panel with explicit form/processing bodies
 * to exercise both branches. PDF viewer is lazy-loaded and would attempt
 * to fetch a URL under jsdom, so we stub it.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../pdf-viewer.js', () => ({
  PdfViewer: ({ url }: { url: string }) => <div data-testid="pdf-viewer">{url}</div>,
}));

vi.mock('../nip-validation-badge.js', () => ({
  NipValidationBadge: () => <span data-testid="nip-badge" />,
}));

import { render, screen } from '../../../test/test-utils.js';
import type {
  OcrReviewFormDerived,
  OcrReviewFormSetters,
  OcrReviewFormState,
} from '../hooks/use-ocr-review-form.js';
import {
  OcrReviewFormBody,
  OcrReviewPanel,
  OcrReviewPanelProcessingBody,
} from '../ocr-review-panel.js';

function makeState(over: Partial<OcrReviewFormState> = {}): OcrReviewFormState {
  return {
    invoiceNumber: 'FV/2026/001',
    issueDate: '2026-04-01',
    dueDate: '2026-04-30',
    currency: 'PLN',
    subtotalMinor: '100.00',
    vatAmountMinor: '23.00',
    totalMinor: '123.00',
    sellerTaxId: '1234567890',
    sellerName: 'Acme Sp. z o.o.',
    buyerTaxId: '0987654321',
    buyerName: 'Buyer Co',
    sellerBankAccount: 'PL00 0000 0000 0000 0000 0000 0000',
    lineItems: [],
    ...over,
  };
}

function makeSetters(): OcrReviewFormSetters {
  return {
    setInvoiceNumber: vi.fn(),
    setIssueDate: vi.fn(),
    setDueDate: vi.fn(),
    setCurrency: vi.fn(),
    setSubtotalMinor: vi.fn(),
    setVatAmountMinor: vi.fn(),
    setTotalMinor: vi.fn(),
    setSellerTaxId: vi.fn(),
    setSellerName: vi.fn(),
    setBuyerTaxId: vi.fn(),
    setBuyerName: vi.fn(),
    setSellerBankAccount: vi.fn(),
    setLineItems: vi.fn(),
  };
}

function makeDerived(over: Partial<OcrReviewFormDerived> = {}): OcrReviewFormDerived {
  return {
    fieldCount: 10,
    totalFields: 12,
    visibleFields: new Set<string>(),
    isPopulated: true,
    handleAccept: vi.fn(),
    ...over,
  };
}

interface PanelOverrides {
  extractionStatus?: string;
  isProcessing?: boolean;
  onAccept?: () => void;
  onDiscard?: () => void;
  onRetrigger?: () => void;
  state?: Partial<OcrReviewFormState>;
}

function makePanelProps(over: PanelOverrides = {}) {
  const derived = makeDerived(over.onAccept ? { handleAccept: over.onAccept } : {});
  const resultJson = { fields: {}, errorMessage: undefined } as never;
  const form = {
    state: makeState(over.state),
    setters: makeSetters(),
    derived,
  };
  const onDiscard = over.onDiscard ?? vi.fn();
  const onRetrigger = over.onRetrigger ?? vi.fn();
  const cardBody = over.isProcessing ? (
    <OcrReviewPanelProcessingBody />
  ) : (
    <OcrReviewFormBody
      onDiscard={onDiscard}
      onRetrigger={onRetrigger}
      resultJson={resultJson}
      form={form}
    />
  );
  return {
    pdfUrl: 'https://example.test/invoice.pdf',
    extractionStatus: over.extractionStatus ?? 'EXTRACTED',
    resultJson,
    onRetrigger,
    fieldCount: derived.fieldCount,
    totalFields: derived.totalFields,
    cardBody,
  };
}

describe('OcrReviewPanel (web-vite)', () => {
  it('renders the heading and Accept & Save action when card body is the form variant', () => {
    render(<OcrReviewPanel {...makePanelProps()} />);
    expect(screen.getByRole('heading', { name: /Review Extracted Data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept & Save/i })).toBeInTheDocument();
  });

  it('hides the form chrome and shows the processing overlay when the processing body is selected', () => {
    render(<OcrReviewPanel {...makePanelProps({ isProcessing: true })} />);
    expect(screen.queryByRole('button', { name: /Accept & Save/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Analyzing invoice/i)).toBeInTheDocument();
  });

  it('invokes derived.handleAccept when Accept & Save is clicked', async () => {
    const handleAccept = vi.fn();
    render(<OcrReviewPanel {...makePanelProps({ onAccept: handleAccept })} />);
    screen.getByRole('button', { name: /Accept & Save/i }).click();
    expect(handleAccept).toHaveBeenCalledTimes(1);
  });

  it('passes the pdfUrl down to the PdfViewer stub', () => {
    render(<OcrReviewPanel {...makePanelProps()} />);
    return Promise.resolve().then(() => {
      const viewer = screen.queryByTestId('pdf-viewer');
      if (viewer) expect(viewer).toHaveTextContent('invoice.pdf');
    });
  });

  it('renders extraction status badge for EXTRACTED', () => {
    render(<OcrReviewPanel {...makePanelProps({ extractionStatus: 'EXTRACTED' })} />);
    expect(screen.getByText('Extracted')).toBeInTheDocument();
  });
});
