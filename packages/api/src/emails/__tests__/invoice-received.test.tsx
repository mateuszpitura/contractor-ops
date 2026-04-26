import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { InvoiceReceivedEmail } from '../invoice-received.js';

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
      const el = n as ReactElement<{ children?: ReactNode; render?: unknown }>;
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

function renderText(node: ReactNode): string {
  return collectText(node).join(' ');
}

describe('InvoiceReceivedEmail', () => {
  const minimalProps = {
    title: 'New Invoice Received',
    body: 'A new invoice has been submitted for processing.',
    ctaUrl: 'https://app.example.com/invoices/789',
    preferencesUrl: 'https://app.example.com/settings/notifications',
  };

  it('renders title and body with minimal props', () => {
    const tree = InvoiceReceivedEmail(minimalProps);
    const text = renderText(tree);

    expect(text).toContain('New Invoice Received');
    expect(text).toContain('A new invoice has been submitted for processing.');
  });

  it('renders invoice details when all optional props are provided', () => {
    const tree = InvoiceReceivedEmail({
      ...minimalProps,
      invoiceNumber: 'INV-2026-0099',
      contractorName: 'DevShop Ltd',
      amount: '8,200.00 GBP',
    });
    const text = renderText(tree);

    expect(text).toContain('Invoice');
    expect(text).toContain('INV-2026-0099');
    expect(text).toContain('From');
    expect(text).toContain('DevShop Ltd');
    expect(text).toContain('Amount');
    expect(text).toContain('8,200.00 GBP');
  });

  it('omits details section when invoiceNumber is not provided', () => {
    const tree = InvoiceReceivedEmail(minimalProps);
    const text = renderText(tree);

    expect(text).not.toContain('From');
    expect(text).not.toContain('Amount');
  });

  it('renders custom labels when provided', () => {
    const tree = InvoiceReceivedEmail({
      ...minimalProps,
      invoiceNumber: 'RE-2026-0001',
      contractorName: 'Berater GmbH',
      amount: '4.500,00 EUR',
      labels: {
        invoice: 'Rechnung',
        from: 'Von',
        amount: 'Betrag',
      },
    });
    const text = renderText(tree);

    expect(text).toContain('Rechnung');
    expect(text).toContain('Von');
    expect(text).toContain('Betrag');
  });

  it('renders invoiceNumber without contractorName or amount', () => {
    const tree = InvoiceReceivedEmail({
      ...minimalProps,
      invoiceNumber: 'INV-SOLO',
    });
    const text = renderText(tree);

    expect(text).toContain('Invoice');
    expect(text).toContain('INV-SOLO');
    expect(text).not.toContain('From');
    expect(text).not.toContain('Amount');
  });
});
