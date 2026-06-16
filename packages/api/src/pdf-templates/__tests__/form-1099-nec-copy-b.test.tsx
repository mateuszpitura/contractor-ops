// Form1099NecCopyBDocument template contract tests — Wave-0 RED scaffold (US-FORM-04).
//
// The recipient Copy-B PDF (substitute, black ink, Pub 1179 §4.6) must render to
// a non-empty Buffer from the stored immutable snapshot and must show the
// recipient TIN as last-4 ONLY (Pub 1179 masking + the P84/P85 SsnMaskedReveal
// invariant — a full SSN never reaches the document). Text assertions walk the
// React tree (the PDF binary encodes glyphs in ways that defeat substring
// scans), mirroring the ir35-sds template test.
//
// The template does not exist yet, so this suite fails at module resolution —
// terminal-RED accepted for Wave 0.

import { renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { Form1099NecCopyBDocument } from '../form-1099-nec-copy-b';

function collectText(node: ReactNode): string[] {
  const out: string[] = [];
  function walk(n: ReactNode): void {
    if (n == null || typeof n === 'boolean') return;
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (typeof n === 'object' && 'props' in (n as object)) {
      const el = n as ReactElement<{ children?: ReactNode }>;
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

const FIXTURE = {
  taxYear: 2026,
  payerName: 'Acme Org',
  recipientName: 'Jane Q. Contractor',
  recipientTinLast4: '1120',
  box1AmountMinor: 250_000,
  box4BackupWithholdingMinor: 0,
  currency: 'USD',
};

describe('Form1099NecCopyBDocument — recipient Copy B (US-FORM-04 / D-09)', () => {
  it('renders to a non-empty PDF Buffer', async () => {
    const buffer = await renderToBuffer(Form1099NecCopyBDocument(FIXTURE));

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('shows the recipient TIN as last-4 only (never a full SSN)', () => {
    const text = collectText(Form1099NecCopyBDocument(FIXTURE)).join(' ');

    expect(text).toContain('1120');
    expect(text).not.toContain('078051120');
  });
});
