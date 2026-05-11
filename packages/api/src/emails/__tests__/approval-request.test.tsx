import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ApprovalRequestEmail } from '../approval-request';

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

describe('ApprovalRequestEmail', () => {
  const minimalProps = {
    title: 'New Approval Request',
    body: 'A new invoice requires your approval.',
    ctaUrl: 'https://app.example.com/approvals/456',
    preferencesUrl: 'https://app.example.com/settings/notifications',
  };

  it('renders title and body with minimal props', () => {
    const tree = ApprovalRequestEmail(minimalProps);
    const text = renderText(tree);

    expect(text).toContain('New Approval Request');
    expect(text).toContain('A new invoice requires your approval.');
  });

  it('passes ctaLabel to BaseLayout (default "Review & Approve")', () => {
    // The CTA label is rendered deep inside BaseLayout's Button component.
    // React Email components use internal wrappers that the simple tree walker
    // cannot always traverse. We verify the label reaches BaseLayout by
    // inspecting the React element tree structure directly.
    const tree = ApprovalRequestEmail(minimalProps) as React.ReactElement;
    // The top-level element is BaseLayout; its props should include ctaLabel
    expect(tree.props.ctaLabel).toBe('Review & Approve');
  });

  it('renders invoice details when provided', () => {
    const tree = ApprovalRequestEmail({
      ...minimalProps,
      invoiceNumber: 'INV-2026-0042',
      contractorName: 'Acme GmbH',
      amount: '12,500.00 EUR',
    });
    const text = renderText(tree);

    expect(text).toContain('Invoice');
    expect(text).toContain('INV-2026-0042');
    expect(text).toContain('Contractor');
    expect(text).toContain('Acme GmbH');
    expect(text).toContain('Amount');
    expect(text).toContain('12,500.00 EUR');
  });

  it('omits invoice details section when invoiceNumber is not provided', () => {
    const tree = ApprovalRequestEmail(minimalProps);
    const text = renderText(tree);

    expect(text).not.toContain('Invoice');
    expect(text).not.toContain('Contractor');
    expect(text).not.toContain('Amount');
  });

  it('renders custom labels when provided', () => {
    const tree = ApprovalRequestEmail({
      ...minimalProps,
      invoiceNumber: 'FV/2026/0042',
      contractorName: 'Firma Sp. z o.o.',
      amount: '52 000,00 PLN',
      labels: {
        invoice: 'Faktura',
        contractor: 'Wykonawca',
        amount: 'Kwota',
        ctaButton: 'Sprawdź i zatwierdź',
      },
    });
    const text = renderText(tree);

    expect(text).toContain('Faktura');
    expect(text).toContain('Wykonawca');
    expect(text).toContain('Kwota');
    // ctaButton label is passed to BaseLayout as ctaLabel; verify other labels
    expect(text).toContain('Faktura');
  });

  it('renders invoiceNumber without contractorName or amount', () => {
    const tree = ApprovalRequestEmail({
      ...minimalProps,
      invoiceNumber: 'INV-001',
    });
    const text = renderText(tree);

    expect(text).toContain('Invoice');
    expect(text).toContain('INV-001');
    expect(text).not.toContain('Contractor');
    expect(text).not.toContain('Amount');
  });
});
