import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('next/image', () => ({
  default: ({ alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...rest} />
  ),
}));

import { PeppolQRDisplay } from '../peppol-qr-display';

describe('PeppolQRDisplay', () => {
  it('renders the QR image with correct alt text', () => {
    render(
      <PeppolQRDisplay qrCodeBase64="data:image/png;base64,abc123" invoiceNumber="INV-2026-001" />,
    );
    const img = screen.getByAltText('UAE FTA QR code for invoice INV-2026-001');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('renders the descriptive caption', () => {
    render(
      <PeppolQRDisplay qrCodeBase64="data:image/png;base64,abc123" invoiceNumber="INV-2026-001" />,
    );
    expect(screen.getByText('UAE FTA QR Code — Scan to verify')).toBeInTheDocument();
  });

  it('returns null when qrCodeBase64 is empty', () => {
    const { container } = render(<PeppolQRDisplay qrCodeBase64="" invoiceNumber="INV-2026-001" />);
    expect(container.innerHTML).toBe('');
  });
});
