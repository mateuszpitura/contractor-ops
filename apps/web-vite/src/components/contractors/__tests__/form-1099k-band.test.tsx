/**
 * The 1099-K band is read-only and informational: SAFE is neutral; APPROACHING
 * and OVER stay amber (never destructive); there is no filing affordance. We
 * mock the tracker hook to drive each band.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ useForm1099kTracker: vi.fn() }));

vi.mock('../hooks/use-1099k-tracker.js', () => ({
  useForm1099kTracker: hooks.useForm1099kTracker,
}));

import { render, screen } from '../../../test/test-utils.js';
import { Form1099kBand } from '../form-1099k-band.js';

function tracker(band: 'SAFE' | 'APPROACHING' | 'OVER', over: Record<string, unknown> = {}) {
  return {
    taxYear: 2026,
    band,
    cumulativePayoutMinor: 1_850_000,
    transactionCount: 180,
    lastScannedAt: null,
    lastCrossedAt: null,
    threshold: {
      amountThresholdMinor: 2_000_000,
      transactionCountThreshold: 200,
      currency: 'USD',
    },
    informationalOnly: true,
    ...over,
  };
}

function setTracker(over: Record<string, unknown> = {}) {
  hooks.useForm1099kTracker.mockReturnValue({
    tracker: tracker('SAFE'),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setTracker();
});

describe('Form1099kBand', () => {
  it('loading → aria-busy skeleton', () => {
    setTracker({ isPending: true, tracker: undefined });
    render(<Form1099kBand contractorId="c_1" />);
    expect(screen.getByTestId('form-1099k-band')).toHaveAttribute('aria-busy', 'true');
  });

  it('SAFE band renders neutral secondary, no alarm', () => {
    setTracker({ tracker: tracker('SAFE') });
    render(<Form1099kBand contractorId="c_1" />);
    const badge = screen.getByTestId('form-1099k-band-badge');
    expect(badge).toHaveAttribute('data-band', 'SAFE');
    expect(badge.className).not.toMatch(/bg-destructive|text-destructive/);
  });

  it('APPROACHING band is amber, never destructive, and states we do not file', () => {
    setTracker({ tracker: tracker('APPROACHING') });
    render(<Form1099kBand contractorId="c_1" />);
    const badge = screen.getByTestId('form-1099k-band-badge');
    expect(badge).toHaveAttribute('data-band', 'APPROACHING');
    expect(badge.className).not.toMatch(/bg-destructive|text-destructive/);
    expect(screen.getByText(/we don't file 1099-K/i)).toBeInTheDocument();
  });

  it('OVER band stays amber (not destructive) and points at the settlor', () => {
    setTracker({
      tracker: tracker('OVER', { cumulativePayoutMinor: 2_500_000, transactionCount: 240 }),
    });
    render(<Form1099kBand contractorId="c_1" />);
    const badge = screen.getByTestId('form-1099k-band-badge');
    expect(badge).toHaveAttribute('data-band', 'OVER');
    expect(badge.className).not.toMatch(/bg-destructive|text-destructive/);
    expect(screen.getByText(/settlor/i)).toBeInTheDocument();
  });

  it('offers no filing/generate/fix affordance and no alert', () => {
    setTracker({ tracker: tracker('OVER') });
    render(<Form1099kBand contractorId="c_1" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /file|generate|fix/i })).toBeNull();
  });

  it('empty copy when no reportable payouts are tracked', () => {
    setTracker({
      tracker: tracker('SAFE', { cumulativePayoutMinor: 0, transactionCount: 0 }),
    });
    render(<Form1099kBand contractorId="c_1" />);
    expect(screen.getByText(/no reportable payouts tracked for 2026/i)).toBeInTheDocument();
  });
});
