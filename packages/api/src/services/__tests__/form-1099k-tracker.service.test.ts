// Form 1099-K band tracker — Wave-0 RED scaffold.
//
// `form-1099k-tracker.service` does not exist yet, so importing it fails at
// resolution and this suite is terminal-RED until the tracker lands. The
// assertions pin the D-10 / D-11 contract, mirroring the shipped
// economic-dependency-scan sibling:
//   - the band transitions SAFE → APPROACHING → OVER against a tax-year-keyed
//     config of $20,000 AND 200 transactions (the OBBBA figures — NOT the stale
//     $5,000 / $600 threshold);
//   - a same-band re-fire is suppressed until the reminder cadence elapses
//     (lastReminderAt dedup);
//   - the scan is purely informational and NEVER files a 1099-K.

import { describe, expect, it } from 'vitest';

import {
  bandFor1099K,
  type Form1099KBand,
  type Form1099KThresholdConfig,
  updateTrackerBandState,
} from '../form-1099k-tracker.service';

// OBBBA TY2026 threshold config: $20,000 gross AND 200 transactions.
const TY2026_CONFIG: Form1099KThresholdConfig = {
  taxYear: 2026,
  amountThresholdMinor: 2_000_000,
  transactionCountThreshold: 200,
};

describe('bandFor1099K — $20,000 + 200 transaction thresholds (OBBBA, not $5K/$600)', () => {
  it('is SAFE well below the threshold', () => {
    const band: Form1099KBand = bandFor1099K(
      { cumulativePayoutMinor: 500_000, transactionCount: 40 },
      TY2026_CONFIG,
    );
    expect(band).toBe('SAFE');
  });

  it('is APPROACHING as the payout nears the $20,000 threshold', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 1_800_000, transactionCount: 190 },
      TY2026_CONFIG,
    );
    expect(band).toBe('APPROACHING');
  });

  it('is OVER once both the $20,000 and the 200-transaction thresholds are crossed', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 2_100_000, transactionCount: 205 },
      TY2026_CONFIG,
    );
    expect(band).toBe('OVER');
  });

  it('does NOT treat the stale $600 figure as OVER', () => {
    const band = bandFor1099K(
      { cumulativePayoutMinor: 60_000, transactionCount: 3 },
      TY2026_CONFIG,
    );
    expect(band).toBe('SAFE');
  });
});

describe('updateTrackerBandState — same-band re-fire suppression', () => {
  it('suppresses a re-fire inside the reminder cadence via lastReminderAt', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    const result = updateTrackerBandState(
      { currentBand: 'APPROACHING', lastReminderAt: new Date('2026-06-09T00:00:00.000Z') },
      'APPROACHING',
      now,
    );
    expect(result.emitted).toBe(false);
  });

  it('re-fires once the reminder cadence has elapsed', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    const result = updateTrackerBandState(
      { currentBand: 'APPROACHING', lastReminderAt: new Date('2026-06-01T00:00:00.000Z') },
      'APPROACHING',
      now,
    );
    expect(result.emitted).toBe(true);
  });
});

describe('1099-K tracker — informational-only invariant', () => {
  it('the tracker service exports no filing entry point (it never files a 1099-K)', async () => {
    const mod = await import('../form-1099k-tracker.service');
    const surface = Object.keys(mod);
    expect(surface.some(name => /file|generate|transmit|submit/i.test(name))).toBe(false);
  });
});
