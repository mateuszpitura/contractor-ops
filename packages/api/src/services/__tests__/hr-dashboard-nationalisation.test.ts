import { describe, expect, it } from 'vitest';
import type { SaudizationDashboardParams } from '../saudization-dashboard';
import { computeNationalisationDashboard } from '../saudization-dashboard';

function params(overrides: Partial<SaudizationDashboardParams> = {}): SaudizationDashboardParams {
  return {
    headcount: { totalHeadcount: 100, saudiHeadcount: 40 },
    config: { band: 'MID_GREEN', industrySegment: 'construction', bandLastUpdatedAt: null },
    platformContractors: [],
    iqamaItems: [],
    now: new Date('2026-06-15T00:00:00Z'),
    ...overrides,
  };
}

describe('computeNationalisationDashboard — per-country manual-input + read-through band', () => {
  it('KSA: rate comes from the manual headcount only; band is read-through', () => {
    const result = computeNationalisationDashboard('KSA', params());
    expect(result.country).toBe('KSA');
    expect(result.nationalisationRate).toBe(0.4); // 40 / 100 — manual only
    expect(result.band).toBe('MID_GREEN'); // verbatim from config, never derived
  });

  it('UAE (Emiratisation): identical manual-input derivation, no auto-band', () => {
    const result = computeNationalisationDashboard(
      'UAE',
      params({
        headcount: { totalHeadcount: 50, saudiHeadcount: 10 }, // manual Emirati count
        config: { band: null, industrySegment: null, bandLastUpdatedAt: null },
      }),
    );
    expect(result.country).toBe('UAE');
    expect(result.nationalisationRate).toBe(0.2); // 10 / 50 — manual only
    // No manual band recorded → band stays null; it is NEVER inferred from the rate.
    expect(result.band).toBeNull();
  });

  it('returns a null rate when no manual headcount is recorded (never platform-derived)', () => {
    const result = computeNationalisationDashboard('UAE', params({ headcount: null }));
    expect(result.nationalisationRate).toBeNull();
    expect(result.totalHeadcount).toBeNull();
  });
});
