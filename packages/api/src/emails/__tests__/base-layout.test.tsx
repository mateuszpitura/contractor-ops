import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { BaseLayout } from '../base-layout';

// ---------------------------------------------------------------------------
// Helpers — walk the React tree to extract text (same pattern as ir35-sds tests)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseLayout', () => {
  it('renders brand text and default footer', () => {
    const tree = BaseLayout({ children: 'Hello world' });
    const text = renderText(tree);

    expect(text).toContain('Contractor Ops');
    expect(text).toContain('Contractor Ops - Contractor operations platform');
    expect(text).toContain('Hello world');
  });

  it('renders the default CTA label when ctaUrl is provided without ctaLabel', () => {
    const tree = BaseLayout({
      children: 'Content',
      ctaUrl: 'https://example.com/action',
    });
    const text = renderText(tree);

    expect(text).toContain('View in Contractor Ops');
  });

  it('renders custom ctaLabel when provided', () => {
    const tree = BaseLayout({
      children: 'Content',
      ctaUrl: 'https://example.com/action',
      ctaLabel: 'Open Dashboard',
    });
    const text = renderText(tree);

    expect(text).toContain('Open Dashboard');
  });

  it('uses ctaText as fallback when ctaLabel is not provided', () => {
    const tree = BaseLayout({
      children: 'Content',
      ctaUrl: 'https://example.com/action',
      ctaText: 'Go to Page',
    });
    const text = renderText(tree);

    expect(text).toContain('Go to Page');
  });

  it('does not render CTA button when ctaUrl is omitted', () => {
    const tree = BaseLayout({ children: 'No CTA here' });
    const text = renderText(tree);

    expect(text).not.toContain('View in Contractor Ops');
  });

  it('renders manage preferences link when preferencesUrl is set', () => {
    const tree = BaseLayout({
      children: 'Content',
      preferencesUrl: 'https://example.com/prefs',
    });
    const text = renderText(tree);

    expect(text).toContain('Manage notification preferences');
    expect(text).toContain('Unsubscribe');
  });

  it('renders custom labels for preferences and unsubscribe', () => {
    const tree = BaseLayout({
      children: 'Content',
      preferencesUrl: 'https://example.com/prefs',
      managePrefsLabel: 'Zarządzaj powiadomieniami',
      unsubscribeLabel: 'Wypisz się',
      footerText: 'Custom Footer',
    });
    const text = renderText(tree);

    expect(text).toContain('Zarządzaj powiadomieniami');
    expect(text).toContain('Wypisz się');
    expect(text).toContain('Custom Footer');
  });

  it('renders with minimal props (children only)', () => {
    const tree = BaseLayout({ children: 'Minimal' });
    const text = renderText(tree);

    expect(text).toContain('Minimal');
    expect(text).toContain('Unsubscribe');
  });
});
