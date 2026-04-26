import type { Ir35Outcome, ScheinselbstandigkeitOutcome } from '@contractor-ops/classification';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/test/test-utils';

import { VerdictBanner } from '../verdict-banner';

describe('VerdictBanner', () => {
  it('renders a status region with the label', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'outside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Outside IR35" />);

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-label', 'Outside IR35');
  });

  it('renders the verdict label text', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'inside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Inside IR35" />);

    expect(screen.getByText('Inside IR35')).toBeInTheDocument();
  });

  it('renders subline when provided', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'indeterminate',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(
      <VerdictBanner
        kind="ir35"
        outcome={outcome}
        label="Indeterminate"
        subline="Rule set v2024 - completed 2025-01-01"
      />,
    );

    expect(screen.getByText('Rule set v2024 - completed 2025-01-01')).toBeInTheDocument();
  });

  it('does not render subline when not provided', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'outside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Outside IR35" />);

    const banner = screen.getByTestId('verdict-banner');
    const spans = banner.querySelectorAll('span.text-sm');
    expect(spans).toHaveLength(0);
  });

  it('sets data-tone to success for IR35 outside verdict', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'outside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Outside" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-tone', 'success');
  });

  it('sets data-tone to destructive for IR35 inside verdict', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'inside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Inside" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-tone', 'destructive');
  });

  it('sets data-tone to warning for IR35 indeterminate verdict', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'indeterminate',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Indeterminate" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-tone', 'warning');
  });

  it('handles DRV green verdict with success tone', () => {
    const outcome = {
      kind: 'Scheinselbstaendigkeit',
      verdict: 'green',
      ruleSetVersion: 'DRV-2024',
      categories: [],
      totalScore: 25,
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="drv" outcome={outcome as never} label="Low Risk" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-tone', 'success');
  });

  it('handles DRV red verdict with destructive tone', () => {
    const outcome = {
      kind: 'Scheinselbstaendigkeit',
      verdict: 'red',
      ruleSetVersion: 'DRV-2024',
      categories: [],
      totalScore: 80,
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="drv" outcome={outcome as never} label="High Risk" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-tone', 'destructive');
  });

  it('sets data-kind attribute', () => {
    const outcome: Ir35Outcome = {
      kind: 'IR35',
      verdict: 'outside',
      ruleSetVersion: 'IR35-2024',
      areas: [],
      computedAt: new Date().toISOString(),
    };

    render(<VerdictBanner kind="ir35" outcome={outcome} label="Outside" />);

    expect(screen.getByTestId('verdict-banner')).toHaveAttribute('data-kind', 'ir35');
  });
});
