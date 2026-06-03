// Phase 79 · D-02 — pure-transform tests for the free-zone backfill.
//
// `planFreeZoneBackfill` maps AE contractors' freeform `countryFields` UAE license
// values into the structured FreeZoneAssignment rows to insert. The transform is
// the load-bearing, idempotent, network-free core of
// backfill-free-zone-assignment.ts (the script's $transaction write is a thin
// wrapper). These tests assert the documented mapping + the D-02 guards.

import { describe, expect, it } from 'vitest';
import type { ContractorRow } from '../../scripts/backfill-free-zone-assignment.js';
import { planFreeZoneBackfill } from '../../scripts/backfill-free-zone-assignment.js';

function aeContractor(overrides: Partial<ContractorRow> = {}): ContractorRow {
  return {
    id: 'ctr_1',
    organizationId: 'org_1',
    countryCode: 'AE',
    countryFields: { tradeLicenseNumber: 'TL-123', freeZone: true },
    hasAssignment: false,
    ...overrides,
  };
}

describe('free-zone backfill transform (D-02)', () => {
  it('maps freeZone=true → IFZA and carries the license number + expiry', () => {
    const rows = planFreeZoneBackfill([
      aeContractor({
        countryFields: {
          tradeLicenseNumber: 'TL-123',
          freeZone: true,
          tradeLicenseExpiry: '2027-01-15',
        },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contractorId: 'ctr_1',
      organizationId: 'org_1',
      zone: 'IFZA',
      licenseNumber: 'TL-123',
    });
    expect(rows[0]?.licenseExpiresAt).toEqual(new Date('2027-01-15'));
  });

  it('normalizes an unparseable tradeLicenseExpiry to null instead of Invalid Date (WR-04)', () => {
    const rows = planFreeZoneBackfill([
      aeContractor({
        countryFields: {
          tradeLicenseNumber: 'TL-bad',
          freeZone: true,
          tradeLicenseExpiry: '2025-13-01', // month 13 — unparseable
        },
      }),
    ]);
    // The row is still planned (not dropped), but the bad date becomes null so the
    // single-transaction batch is not aborted by an Invalid Date rejected by Postgres.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.licenseExpiresAt).toBeNull();
  });

  it('keeps planning other rows when one contractor has an unparseable expiry (no batch abort) (WR-04)', () => {
    const rows = planFreeZoneBackfill([
      aeContractor({
        id: 'ctr_bad',
        countryFields: { tradeLicenseNumber: 'TL-bad', freeZone: true, tradeLicenseExpiry: 'soon' },
      }),
      aeContractor({
        id: 'ctr_ok',
        countryFields: {
          tradeLicenseNumber: 'TL-ok',
          freeZone: true,
          tradeLicenseExpiry: '2027-03-10',
        },
      }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.contractorId === 'ctr_bad')?.licenseExpiresAt).toBeNull();
    expect(rows.find(r => r.contractorId === 'ctr_ok')?.licenseExpiresAt).toEqual(
      new Date('2027-03-10'),
    );
  });

  it('maps freeZone false/absent → MAINLAND (arms no payment-block gate)', () => {
    const rows = planFreeZoneBackfill([
      aeContractor({ countryFields: { tradeLicenseNumber: 'TL-9', freeZone: false } }),
    ]);
    expect(rows[0]?.zone).toBe('MAINLAND');
  });

  it('is idempotent — contractors with an existing assignment are skipped', () => {
    const rows = planFreeZoneBackfill([aeContractor({ hasAssignment: true })]);
    expect(rows).toEqual([]);
  });

  it('skips contractors with no trade-license number (nothing structured to migrate)', () => {
    const rows = planFreeZoneBackfill([
      aeContractor({ countryFields: { freeZone: true } }),
      aeContractor({ id: 'ctr_2', countryFields: {} }),
      aeContractor({ id: 'ctr_3', countryFields: null }),
    ]);
    expect(rows).toEqual([]);
  });

  it('does NOT migrate non-AE (Saudi) contractors', () => {
    const rows = planFreeZoneBackfill([
      {
        id: 'ctr_sa',
        organizationId: 'org_1',
        countryCode: 'SA',
        countryFields: { tradeLicenseNumber: 'should-be-ignored' },
        hasAssignment: false,
      } as ContractorRow,
    ]);
    expect(rows).toEqual([]);
  });
});
