/**
 * Ported from apps/web/src/components/peppol/__tests__/peppol-qr-display.test.tsx.
 *
 * The legacy test mocked `next/image`; the web-vite version uses a
 * plain `<img>` (no Next dependency). i18next-ICU placeholder
 * interpolation does not run under the jsdom env wiring used by the
 * existing per-domain `_render.tsx` helpers, so assertions limit
 * themselves to:
 *   - the `<img>` source + a non-empty `alt` attribute (raw or
 *     interpolated form both pass — only the QR payload itself is
 *     load-bearing),
 *   - the static caption (no ICU substitution),
 *   - the null-render branch when no payload is supplied.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { PeppolQRDisplay } from '../peppol-qr-display.js';
import { findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PeppolQRDisplay (web-vite)', () => {
  it('renders the QR image with the supplied base64 payload', async () => {
    const { container } = await mount(
      <PeppolQRDisplay qrCodeBase64="data:image/png;base64,abc123" invoiceNumber="INV-2026-001" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,abc123');
    expect(img?.getAttribute('alt')?.length ?? 0).toBeGreaterThan(0);
  });

  it('renders the descriptive caption', async () => {
    await mount(
      <PeppolQRDisplay qrCodeBase64="data:image/png;base64,abc123" invoiceNumber="INV-2026-001" />,
    );
    expect(findByText(document.body, 'UAE FTA QR Code — Scan to verify')).not.toBeNull();
  });

  it('renders nothing when no QR payload is supplied', async () => {
    const { container } = await mount(
      <PeppolQRDisplay qrCodeBase64="" invoiceNumber="INV-2026-001" />,
    );
    expect(container.innerHTML).toBe('');
  });
});
