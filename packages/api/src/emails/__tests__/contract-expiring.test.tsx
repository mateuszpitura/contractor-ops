import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ContractExpiringEmail } from '../contract-expiring.js';

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

describe('ContractExpiringEmail', () => {
  const minimalProps = {
    title: 'Contract Expiring Soon',
    body: 'One of your contracts is approaching its expiry date.',
    ctaUrl: 'https://app.example.com/contracts/42',
    preferencesUrl: 'https://app.example.com/settings/notifications',
  };

  it('renders title and body with minimal props', () => {
    const tree = ContractExpiringEmail(minimalProps);
    const text = renderText(tree);

    expect(text).toContain('Contract Expiring Soon');
    expect(text).toContain('One of your contracts is approaching its expiry date.');
  });

  it('renders contract details when all optional props are provided', () => {
    const tree = ContractExpiringEmail({
      ...minimalProps,
      contractTitle: 'Senior Backend Developer Agreement',
      contractorName: 'Jan Nowak',
      expiryDate: '2026-05-15',
    });
    const text = renderText(tree);

    expect(text).toContain('Contract');
    expect(text).toContain('Senior Backend Developer Agreement');
    expect(text).toContain('Contractor');
    expect(text).toContain('Jan Nowak');
    expect(text).toContain('Expires');
    expect(text).toContain('2026-05-15');
  });

  it('omits details section when contractTitle is not provided', () => {
    const tree = ContractExpiringEmail(minimalProps);
    const text = renderText(tree);

    // Should not contain the detail labels
    expect(text).not.toContain('Expires');
  });

  it('renders custom labels when provided', () => {
    const tree = ContractExpiringEmail({
      ...minimalProps,
      contractTitle: 'Vertrag Backend-Entwicklung',
      contractorName: 'Max Mustermann',
      expiryDate: '15.05.2026',
      labels: {
        contract: 'Vertrag',
        contractor: 'Auftragnehmer',
        expires: 'Ablaufdatum',
      },
    });
    const text = renderText(tree);

    expect(text).toContain('Vertrag');
    expect(text).toContain('Auftragnehmer');
    expect(text).toContain('Ablaufdatum');
  });

  it('renders contractTitle without contractorName or expiryDate', () => {
    const tree = ContractExpiringEmail({
      ...minimalProps,
      contractTitle: 'QA Agreement',
    });
    const text = renderText(tree);

    expect(text).toContain('Contract');
    expect(text).toContain('QA Agreement');
    expect(text).not.toContain('Contractor');
    expect(text).not.toContain('Expires');
  });
});
