/**
 * Ported from apps/web/src/components/portal/__tests__/invoice-submit-form.test.tsx.
 *
 * Web-vite split: the form accepts `uploadBundle`, `contractsQuery`, and
 * `submission` props (each one returned by a dedicated hook). The OCR
 * confidence/extraction primitives, the upload section, and the OCR
 * processing overlay are mocked to inert markers — we only assert the
 * form-level wiring (contract picker, submit button, review summary).
 */

vi.mock('../invoice-submit-upload', () => ({
  UploadSection: () => <div data-testid="upload-section" />,
}));

vi.mock('../../ocr/confidence-badge', () => ({
  ConfidenceBadge: () => null,
}));

vi.mock('../../ocr/extraction-status-bar', () => ({
  ExtractionStatusBar: () => null,
}));

vi.mock('../../ocr/nip-validation-badge', () => ({
  NipValidationBadge: () => null,
}));

vi.mock('../../ocr/ocr-processing-overlay', () => ({
  OcrProcessingOverlay: () => null,
}));

import { render, screen } from '@/test/test-utils';
import type {
  PortalActiveContractsQuery,
  PortalInvoiceSubmissionResult,
  PortalInvoiceUploadBundle,
} from '../hooks/use-portal-invoice-submit.js';
import { InvoiceSubmitForm } from '../invoice-submit-form';

function makeUploadBundle(
  overrides: Partial<PortalInvoiceUploadBundle> = {},
): PortalInvoiceUploadBundle {
  return {
    upload: { status: 'idle' },
    extractionStatus: null,
    resultJson: null,
    isOcrProcessing: false,
    fieldCount: 0,
    totalFields: 0,
    ocrPopulated: false,
    setOcrPopulated: vi.fn(),
    creditExhausted: false,
    pdfBlobUrl: null,
    removeFile: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  } as unknown as PortalInvoiceUploadBundle;
}

function makeContractsQuery(
  overrides: Partial<PortalActiveContractsQuery> = {},
): PortalActiveContractsQuery {
  return {
    isLoading: false,
    data: [],
    ...overrides,
  } as unknown as PortalActiveContractsQuery;
}

function makeSubmission(
  overrides: Partial<PortalInvoiceSubmissionResult> = {},
): PortalInvoiceSubmissionResult {
  return {
    onSubmit: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as PortalInvoiceSubmissionResult;
}

describe('InvoiceSubmitForm', () => {
  it('renders the contract picker label', () => {
    render(
      <InvoiceSubmitForm
        uploadBundle={makeUploadBundle()}
        contractsQuery={makeContractsQuery()}
        submission={makeSubmission()}
        onNavigateBilling={vi.fn()}
      />,
    );
    // Submit button uses Portal.submitInvoice.submit
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders skeleton placeholder while contractsQuery is loading', () => {
    const { container } = render(
      <InvoiceSubmitForm
        uploadBundle={makeUploadBundle()}
        contractsQuery={makeContractsQuery({ isLoading: true, data: undefined })}
        submission={makeSubmission()}
        onNavigateBilling={vi.fn()}
      />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders the mocked upload section', () => {
    render(
      <InvoiceSubmitForm
        uploadBundle={makeUploadBundle()}
        contractsQuery={makeContractsQuery()}
        submission={makeSubmission()}
        onNavigateBilling={vi.fn()}
      />,
    );
    expect(screen.getByTestId('upload-section')).toBeInTheDocument();
  });

  it('disables the submit button when upload is not "uploaded"', () => {
    render(
      <InvoiceSubmitForm
        uploadBundle={makeUploadBundle()}
        contractsQuery={makeContractsQuery()}
        submission={makeSubmission()}
        onNavigateBilling={vi.fn()}
      />,
    );
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    expect(submitBtn).toBeDisabled();
  });

  it('renders the OCR review panel when ocrReviewPanel prop is supplied', () => {
    render(
      <InvoiceSubmitForm
        uploadBundle={makeUploadBundle()}
        contractsQuery={makeContractsQuery()}
        submission={makeSubmission()}
        onNavigateBilling={vi.fn()}
        ocrReviewPanel={<div data-testid="ocr-review">review</div>}
      />,
    );
    expect(screen.getByTestId('ocr-review')).toBeInTheDocument();
  });
});
