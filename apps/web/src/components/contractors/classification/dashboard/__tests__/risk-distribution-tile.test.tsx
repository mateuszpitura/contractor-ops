// ---------------------------------------------------------------------------
// Phase 60 · Plan 04 · CLASS-10 — RiskDistributionTile tests (VALIDATION 60-04-07).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { RiskDistributionTile } from '../risk-distribution-tile';

describe('RiskDistributionTile', () => {
  it('renders 3 segments with widths proportional to {safe, warning, critical}', () => {
    render(
      <RiskDistributionTile counts={{ safe: 5, warning: 3, critical: 2 }} totalCompleted={10} />,
    );
    const bar = screen.getByTestId('risk-distribution-bar');
    expect(bar).toBeInTheDocument();
    const segments = bar.querySelectorAll('[data-bucket]');
    expect(segments).toHaveLength(3);

    const bySide = Array.from(segments).map(s => ({
      bucket: s.getAttribute('data-bucket'),
      width: (s as HTMLElement).style.width,
    }));
    expect(bySide).toEqual([
      { bucket: 'safe', width: '50%' },
      { bucket: 'warning', width: '30%' },
      { bucket: 'critical', width: '20%' },
    ]);
  });

  it("exposes role='img' + aria-label summarising counts and percentages", () => {
    render(
      <RiskDistributionTile counts={{ safe: 5, warning: 3, critical: 2 }} totalCompleted={10} />,
    );
    const bar = screen.getByTestId('risk-distribution-bar');
    expect(bar.getAttribute('role')).toBe('img');
    const label = bar.getAttribute('aria-label') ?? '';
    expect(label).toContain('50%');
    expect(label).toContain('30%');
    expect(label).toContain('20%');
  });

  it('uses OKLCh semantic tokens via bg-[--success/--warning/--destructive] classes', () => {
    render(
      <RiskDistributionTile counts={{ safe: 5, warning: 3, critical: 2 }} totalCompleted={10} />,
    );
    const bar = screen.getByTestId('risk-distribution-bar');
    const segments = bar.querySelectorAll('[data-bucket]');
    const safe = segments[0] as HTMLElement;
    const warning = segments[1] as HTMLElement;
    const critical = segments[2] as HTMLElement;
    expect(safe.className).toContain('bg-[--success]');
    expect(warning.className).toContain('bg-[--warning]');
    expect(critical.className).toContain('bg-[--destructive]');
  });

  it('omits segments whose count is zero (no empty flex child)', () => {
    render(
      <RiskDistributionTile counts={{ safe: 10, warning: 0, critical: 0 }} totalCompleted={10} />,
    );
    const bar = screen.getByTestId('risk-distribution-bar');
    const segments = bar.querySelectorAll('[data-bucket]');
    expect(segments).toHaveLength(1);
    expect(segments[0]?.getAttribute('data-bucket')).toBe('safe');
  });

  it('renders an empty state when totalCompleted === 0', () => {
    render(
      <RiskDistributionTile counts={{ safe: 0, warning: 0, critical: 0 }} totalCompleted={0} />,
    );
    expect(screen.getByTestId('risk-distribution-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('risk-distribution-bar')).toBeNull();
  });
});
