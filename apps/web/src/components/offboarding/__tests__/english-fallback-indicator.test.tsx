// Phase 74 Plan 07 — RTL test for the locale-fallback indicator.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnglishFallbackIndicator } from '../english-fallback-indicator';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'suffix') return ' (English)';
    if (key === 'srDescription') {
      return `This template field has not been translated to ${vars?.targetLocale}; the English value is shown as a fallback.`;
    }
    return key;
  },
}));

import { vi } from 'vitest';

describe('EnglishFallbackIndicator — D-15', () => {
  it('renders muted (English) suffix', () => {
    render(<EnglishFallbackIndicator targetLocale="pl" />);
    expect(screen.getByText('(English)', { exact: false })).toBeInTheDocument();
  });

  it('exposes a screen-reader description naming the target locale', () => {
    render(<EnglishFallbackIndicator targetLocale="pl" />);
    const descs = screen.getAllByLabelText(/has not been translated to angielski/i);
    expect(descs.length).toBeGreaterThan(0);
  });

  it('renders an Info button that is keyboard-focusable', () => {
    render(<EnglishFallbackIndicator targetLocale="de" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toHaveAttribute('type', 'button');
  });
});
