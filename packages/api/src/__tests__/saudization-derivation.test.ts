// Saudization dashboard derivation tests.
//
// C6 — the nationalisation rate is computed from the MANUAL SaudiHeadcount
//      numbers (org-wide total + Saudi count), NOT from platform contractors.
//      The platform-derived contractor breakdown is shown side-by-side for
//      sanity-check only. The Nitaqat band is NEVER auto-computed — manual
//      entry only (locked legal-liability anti-feature).
// C7 — the offboarding band-trajectory is a live, ephemeral recompute
//      (SaudiHeadcount minus one Saudi national), advisory-only, non-gating,
//      non-authoritative ("may drop to LOW_GREEN — verify in Qiwa"). It must
//      never assert/set a band, and nothing is persisted.
//
// Mirror: computeComplianceHealth (packages/api/src/routers/core/contractor.ts).

import { describe, expect, it } from 'vitest';

import {
  computeSaudizationDashboard,
  projectOffboardingTrajectory,
} from '../services/saudization-dashboard';

describe('C6 (GULF-05/06, D-10) saudization rate from manual headcount; band never auto-computed', () => {
  it('computes the nationalisation rate from manual SaudiHeadcount totals, not platform contractors [79-04]', () => {
    const result = computeSaudizationDashboard({
      headcount: { totalHeadcount: 200, saudiHeadcount: 40 }, // manual → 0.20
      config: { band: 'LOW_GREEN', industrySegment: 'IT', bandLastUpdatedAt: new Date() },
      // platform contractors paint a very different (and wrong if used) picture:
      platformContractors: [
        { isSaudi: true, qiwaContractAuthenticated: true },
        { isSaudi: false, qiwaContractAuthenticated: true },
      ],
      iqamaItems: [],
    });

    // Rate is 40/200 from the MANUAL numbers — NOT 1/2 (=0.5) from the 2 contractors.
    expect(result.nationalisationRate).toBeCloseTo(0.2, 5);
    expect(result.totalHeadcount).toBe(200);
    expect(result.saudiHeadcount).toBe(40);
  });

  it('returns null rate when no manual headcount has been recorded (no platform fallback) [79-04]', () => {
    const result = computeSaudizationDashboard({
      headcount: null, // not yet entered
      config: { band: null, industrySegment: null, bandLastUpdatedAt: null },
      platformContractors: [
        { isSaudi: true, qiwaContractAuthenticated: true },
        { isSaudi: true, qiwaContractAuthenticated: false },
      ],
      iqamaItems: [],
    });

    // No manual numbers → rate is null. The platform contractors do NOT drive it.
    expect(result.nationalisationRate).toBeNull();
  });

  it('returns the platform-derived contractor breakdown side-by-side without driving the rate [79-04]', () => {
    const result = computeSaudizationDashboard({
      headcount: { totalHeadcount: 100, saudiHeadcount: 30 },
      config: { band: 'MID_GREEN', industrySegment: 'IT', bandLastUpdatedAt: new Date() },
      platformContractors: [
        { isSaudi: true, qiwaContractAuthenticated: true },
        { isSaudi: false, qiwaContractAuthenticated: false },
        { isSaudi: false, qiwaContractAuthenticated: false },
      ],
      iqamaItems: [],
    });

    // Side-by-side breakdown is present and subordinate (the rate stays 0.30 manual).
    expect(result.platformDerived).toEqual({
      contractorCount: 3,
      saudiContractorCount: 1,
    });
    expect(result.nationalisationRate).toBeCloseTo(0.3, 5);
    // Qiwa-auth gap = contractors WHERE qiwaContractAuthenticated=false (visibility-only).
    expect(result.qiwaGapCount).toBe(2);
  });

  it('never auto-computes or sets the Nitaqat band — band is read-through manual only [79-04]', () => {
    const fromManual = computeSaudizationDashboard({
      headcount: { totalHeadcount: 1000, saudiHeadcount: 950 }, // 95% — would be PLATINUM if auto-computed
      config: { band: 'RED', industrySegment: 'IT', bandLastUpdatedAt: new Date() }, // admin recorded RED
      platformContractors: [],
      iqamaItems: [],
    });

    // The recorded band is surfaced verbatim — never recomputed from the rate.
    expect(fromManual.band).toBe('RED');

    const noBand = computeSaudizationDashboard({
      headcount: { totalHeadcount: 100, saudiHeadcount: 90 },
      config: { band: null, industrySegment: null, bandLastUpdatedAt: null }, // never recorded
      platformContractors: [],
      iqamaItems: [],
    });
    // No band recorded → null, NOT an inferred band.
    expect(noBand.band).toBeNull();
  });

  it('flags quarterly re-entry when the band was last updated more than ~90 days ago [79-04]', () => {
    const now = new Date('2026-06-03T00:00:00Z');
    const stale = computeSaudizationDashboard({
      headcount: { totalHeadcount: 100, saudiHeadcount: 30 },
      config: {
        band: 'LOW_GREEN',
        industrySegment: 'IT',
        bandLastUpdatedAt: new Date('2026-01-01T00:00:00Z'), // ~153 days before now
      },
      platformContractors: [],
      iqamaItems: [],
      now,
    });
    expect(stale.quarterlyReentryDue).toBe(true);

    const fresh = computeSaudizationDashboard({
      headcount: { totalHeadcount: 100, saudiHeadcount: 30 },
      config: {
        band: 'LOW_GREEN',
        industrySegment: 'IT',
        bandLastUpdatedAt: new Date('2026-05-20T00:00:00Z'), // 14 days before now
      },
      platformContractors: [],
      iqamaItems: [],
      now,
    });
    expect(fresh.quarterlyReentryDue).toBe(false);
  });

  it('rolls up Iqama expiry buckets from the F1 ksa.iqama compliance items (reuse, not re-derive) [79-04]', () => {
    const now = new Date('2026-06-03T00:00:00Z');
    const result = computeSaudizationDashboard({
      headcount: { totalHeadcount: 100, saudiHeadcount: 30 },
      config: { band: 'LOW_GREEN', industrySegment: 'IT', bandLastUpdatedAt: now },
      platformContractors: [],
      iqamaItems: [
        { status: 'EXPIRED', expiresAt: new Date('2026-05-01T00:00:00Z') }, // already expired
        { status: 'PENDING', expiresAt: new Date('2026-06-20T00:00:00Z') }, // expiring soon (<30d)
        { status: 'PENDING', expiresAt: new Date('2026-09-01T00:00:00Z') }, // later
      ],
      now,
    });

    expect(result.iqamaRollup).toEqual({ total: 3, expired: 1, expiringSoon: 1 });
  });
});

describe('C7 (GULF-07, D-12) offboarding band-trajectory — ephemeral, advisory, non-gating', () => {
  it('recomputes the projected rate from SaudiHeadcount minus one Saudi national [79-04]', () => {
    const result = projectOffboardingTrajectory({
      headcount: { totalHeadcount: 100, saudiHeadcount: 50 }, // current rate 0.50
      currentBand: 'MID_GREEN',
      offboardingContractorIsSaudi: true,
    });

    // Offboarding a Saudi national → 49/99 ≈ 0.4949...
    expect(result.currentRate).toBeCloseTo(0.5, 5);
    expect(result.projectedRate).toBeCloseTo(49 / 99, 5);
    expect(result.projectedRate).toBeLessThan(result.currentRate ?? 1);
  });

  it('does NOT change the rate when the offboarding contractor is not Saudi [79-04]', () => {
    const result = projectOffboardingTrajectory({
      headcount: { totalHeadcount: 100, saudiHeadcount: 50 },
      currentBand: 'MID_GREEN',
      offboardingContractorIsSaudi: false,
    });
    // Non-Saudi leaving: Saudi count unchanged, total minus 1 → 50/99 (rate ticks UP, never down).
    expect(result.projectedRate).toBeCloseTo(50 / 99, 5);
  });

  it('returns non-authoritative advisory wording and does not assert a band [79-04]', () => {
    const result = projectOffboardingTrajectory({
      headcount: { totalHeadcount: 100, saudiHeadcount: 50 },
      currentBand: 'MID_GREEN',
      offboardingContractorIsSaudi: true,
    });

    expect(result.advisory).toBe(true);
    expect(result.authoritative).toBe(false);
    // It surfaces the CURRENT (recorded) band only — it never asserts a projected band.
    expect(result.currentBand).toBe('MID_GREEN');
    expect(result).not.toHaveProperty('projectedBand');
  });

  it('persists nothing and does not gate the offboarding flow [79-04]', () => {
    // Pure function: no client argument, no DB write, no throw — it cannot gate.
    expect(projectOffboardingTrajectory.length).toBe(1); // single params arg, no DB client
    const result = projectOffboardingTrajectory({
      headcount: null, // even with no manual headcount it returns advisory flags, never throws
      currentBand: null,
      offboardingContractorIsSaudi: true,
    });
    expect(result.advisory).toBe(true);
    expect(result.authoritative).toBe(false);
    expect(result.currentRate).toBeNull();
    expect(result.projectedRate).toBeNull();
  });
});
