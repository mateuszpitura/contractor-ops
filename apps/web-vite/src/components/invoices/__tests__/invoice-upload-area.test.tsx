import { createRef } from 'react';

import { render, screen, setup } from '@/test/test-utils';
import type { UploadingFile } from '../hooks/use-invoice-upload';
import { InvoiceUploadArea } from '../invoice-upload-area';

function baseProps(overrides: Partial<Parameters<typeof InvoiceUploadArea>[0]> = {}) {
  const fileInputRef = createRef<HTMLInputElement | null>();
  return {
    t: (key: string, _values?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        body: 'Drag and drop PDF files here, or click to browse',
        accepted: 'PDF files only',
        retry: 'Retry',
        hidePdf: 'Hide PDF',
        viewPdf: 'View PDF',
      };
      return map[key] ?? key;
    },
    files: [] as UploadingFile[],
    creditExhausted: false,
    isDragActive: false,
    fileInputRef,
    onSetDragActive: vi.fn(),
    onIngestFiles: vi.fn(),
    onRetryFile: vi.fn(),
    hasOcrSession: false,
    showPdfReview: false,
    onTogglePdfReview: vi.fn(),
    ocrReviewPanel: null,
    ...overrides,
  };
}

describe('InvoiceUploadArea', () => {
  it('renders the drop-zone with body + accepted-formats copy', () => {
    render(<InvoiceUploadArea {...baseProps()} />);
    expect(screen.getByText(/Drag and drop PDF files here/i)).toBeInTheDocument();
    expect(screen.getByText('PDF files only')).toBeInTheDocument();
  });

  it('shows neither View PDF nor Hide PDF when there is no OCR session', () => {
    render(<InvoiceUploadArea {...baseProps()} />);
    expect(screen.queryByText('Hide PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('View PDF')).not.toBeInTheDocument();
  });

  it('exposes Hide PDF toggle when an OCR session is active and review is open', () => {
    render(<InvoiceUploadArea {...baseProps({ hasOcrSession: true, showPdfReview: true })} />);
    expect(screen.getByText('Hide PDF')).toBeInTheDocument();
  });

  it('exposes View PDF toggle when an OCR session is active but review is hidden', () => {
    render(<InvoiceUploadArea {...baseProps({ hasOcrSession: true, showPdfReview: false })} />);
    expect(screen.getByText('View PDF')).toBeInTheDocument();
  });

  it('calls onTogglePdfReview when the toggle button is clicked', async () => {
    const onTogglePdfReview = vi.fn();
    const { user } = setup(
      <InvoiceUploadArea
        {...baseProps({ hasOcrSession: true, showPdfReview: true, onTogglePdfReview })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Hide PDF/i }));
    expect(onTogglePdfReview).toHaveBeenCalledTimes(1);
  });

  it('renders an error-row Retry button for files in the error state', async () => {
    const onRetryFile = vi.fn();
    const errorFile: UploadingFile = {
      id: 'f-1',
      file: new File(['x'], 'broken.pdf', { type: 'application/pdf' }),
      progress: 0,
      status: 'error',
    } as UploadingFile;
    const { user } = setup(
      <InvoiceUploadArea {...baseProps({ files: [errorFile], onRetryFile })} />,
    );
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    await user.click(retryBtn);
    expect(onRetryFile).toHaveBeenCalledWith('f-1');
  });

  it('renders an injected OCR review panel via ocrReviewPanel slot', () => {
    render(
      <InvoiceUploadArea
        {...baseProps({ ocrReviewPanel: <div data-testid="ocr-slot">slot</div> })}
      />,
    );
    expect(screen.getByTestId('ocr-slot')).toBeInTheDocument();
  });
});
