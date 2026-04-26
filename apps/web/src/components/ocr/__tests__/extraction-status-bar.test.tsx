import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ExtractionStatusBar } from '../extraction-status-bar';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ExtractionStatusBar', () => {
  it('returns null for PENDING status', () => {
    const { container } = render(<ExtractionStatusBar status="PENDING" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Processing badge and spinner for PROCESSING status', () => {
    render(<ExtractionStatusBar status="PROCESSING" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText(/Extracting invoice data/)).toBeInTheDocument();
  });

  it('shows Extracted badge with field count for EXTRACTED status', () => {
    render(<ExtractionStatusBar status="EXTRACTED" fieldCount={12} />);
    expect(screen.getByText('Extracted')).toBeInTheDocument();
    expect(screen.getByText(/12 fields extracted/)).toBeInTheDocument();
  });

  it('shows Partial badge with field counts for PARTIAL status', () => {
    render(<ExtractionStatusBar status="PARTIAL" fieldCount={8} totalFields={12} />);
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText(/8 of 12 fields/)).toBeInTheDocument();
  });

  it('shows Failed badge with default error message', () => {
    render(<ExtractionStatusBar status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Extraction failed/)).toBeInTheDocument();
  });

  it('shows custom error message for FAILED status', () => {
    render(<ExtractionStatusBar status="FAILED" errorMessage="OCR service unavailable" />);
    expect(screen.getByText('OCR service unavailable')).toBeInTheDocument();
  });

  it('shows retry button for FAILED status when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ExtractionStatusBar status="FAILED" onRetry={onRetry} />);
    const retryButton = screen.getByRole('button', { name: /Re-run OCR/i });
    expect(retryButton).toBeInTheDocument();
    retryButton.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not show retry button when onRetry not provided', () => {
    render(<ExtractionStatusBar status="FAILED" />);
    expect(screen.queryByRole('button', { name: /Re-run OCR/i })).not.toBeInTheDocument();
  });
});
