import { describe, expect, it } from 'vitest';
import type { EmployeeDocExpiryInput } from '../hr-dashboard-doc-expiry';
import { deriveEmployeeDocExpiry, tzForCountry } from '../hr-dashboard-doc-expiry';

const NOW = new Date('2026-06-15T12:00:00Z');

function doc(overrides: Partial<EmployeeDocExpiryInput>): EmployeeDocExpiryInput {
  return {
    documentId: overrides.documentId ?? 'doc-1',
    expiresAt: overrides.expiresAt ?? null,
    docCategory: overrides.docCategory ?? 'VISA',
    section: overrides.section ?? 'SECTION_A',
    countryCode: overrides.countryCode ?? 'PL',
    workerId: overrides.workerId ?? 'w-1',
    workerDisplayName: overrides.workerDisplayName ?? 'Jan Kowalski',
    ...overrides,
  };
}

describe('deriveEmployeeDocExpiry — band boundaries via daysUntilExpiryInTz', () => {
  it('buckets each document into the expired/30/60/90/later band', () => {
    const rows: EmployeeDocExpiryInput[] = [
      doc({ documentId: 'past', expiresAt: new Date('2026-06-14') }), // -1 → expired
      doc({ documentId: 'today', expiresAt: new Date('2026-06-15') }), // 0 → soon30
      doc({ documentId: 'd45', expiresAt: new Date('2026-07-30') }), // ~45 → soon60
      doc({ documentId: 'd76', expiresAt: new Date('2026-08-30') }), // ~76 → soon90
      doc({ documentId: 'd183', expiresAt: new Date('2026-12-15') }), // ~183 → later
    ];
    const result = deriveEmployeeDocExpiry(rows, NOW);
    expect(result.byBand).toEqual({ expired: 1, soon30: 1, soon60: 1, soon90: 1, later: 1 });
    expect(result.items).toHaveLength(5);
    // Sorted ascending by daysUntilExpiry — the expired row comes first.
    expect(result.items[0]?.documentId).toBe('past');
  });

  it('excludes rows with a null expiresAt (non-expiring documents)', () => {
    const rows = [
      doc({ documentId: 'no-expiry', expiresAt: null }),
      doc({ documentId: 'has-expiry', expiresAt: new Date('2026-06-20') }),
    ];
    const result = deriveEmployeeDocExpiry(rows, NOW);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.documentId).toBe('has-expiry');
  });

  it('groups counts by category', () => {
    const rows = [
      doc({ documentId: 'a', docCategory: 'VISA', expiresAt: new Date('2026-06-20') }),
      doc({ documentId: 'b', docCategory: 'VISA', expiresAt: new Date('2026-06-25') }),
      doc({ documentId: 'c', docCategory: 'WORK_PERMIT', expiresAt: new Date('2026-06-30') }),
    ];
    const result = deriveEmployeeDocExpiry(rows, NOW);
    expect(result.byCategory).toEqual({ VISA: 2, WORK_PERMIT: 1 });
  });

  it('resolves the expiry TZ from the country code', () => {
    expect(tzForCountry('SA')).toBe('Asia/Riyadh');
    expect(tzForCountry('AE')).toBe('Asia/Dubai');
    expect(tzForCountry('GB')).toBe('Europe/London');
    expect(tzForCountry('ZZ')).toBe('UTC');
  });
});
