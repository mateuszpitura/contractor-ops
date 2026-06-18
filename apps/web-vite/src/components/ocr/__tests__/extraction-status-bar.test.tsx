/**
 * Step-10 port. Web-vite test-utils wraps i18next + the shared providers, so
 * the legacy `motion/react` shim isn't needed — the component renders inline
 * SVG/CSS animations.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';
import { ExtractionStatusBar } from '../extraction-status-bar.js';

describe('ExtractionStatusBar (web-vite)', () => {
  it('renders nothing for PENDING status', () => {
    const { container } = render(<ExtractionStatusBar status="PENDING" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the Processing badge and spinner copy for PROCESSING', () => {
    render(<ExtractionStatusBar status="PROCESSING" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText(/Extracting invoice data/)).toBeInTheDocument();
  });

  it('shows the Extracted badge with the field count for EXTRACTED', () => {
    render(<ExtractionStatusBar status="EXTRACTED" fieldCount={12} />);
    expect(screen.getByText('Extracted')).toBeInTheDocument();
    expect(screen.getByText(/12 fields extracted/)).toBeInTheDocument();
  });

  it('shows the Partial badge with both counts for PARTIAL', () => {
    render(<ExtractionStatusBar status="PARTIAL" fieldCount={8} totalFields={12} />);
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText(/8 of 12 fields/)).toBeInTheDocument();
  });

  it('shows the default error message for FAILED', () => {
    render(<ExtractionStatusBar status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Extraction failed/)).toBeInTheDocument();
  });

  it('shows a custom error message when provided', () => {
    render(<ExtractionStatusBar status="FAILED" errorMessage="OCR service unavailable" />);
    expect(screen.getByText('OCR service unavailable')).toBeInTheDocument();
  });

  it('shows the Re-run OCR button and invokes onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<ExtractionStatusBar status="FAILED" onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: /Re-run OCR/i });
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when onRetry is not supplied', () => {
    render(<ExtractionStatusBar status="FAILED" />);
    expect(screen.queryByRole('button', { name: /Re-run OCR/i })).not.toBeInTheDocument();
  });

  it('renders SKIPPED as a manual-entry state, not an error', () => {
    render(<ExtractionStatusBar status="SKIPPED" />);
    expect(screen.getByText('Manual entry')).toBeInTheDocument();
    expect(screen.getByText(/disabled/i)).toBeInTheDocument();
    // SKIPPED must not surface the failure copy.
    expect(screen.queryByText(/Extraction failed/)).not.toBeInTheDocument();
  });

  it('shows the Re-run OCR button for SKIPPED and invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<ExtractionStatusBar status="SKIPPED" onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: /Re-run OCR/i });
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
