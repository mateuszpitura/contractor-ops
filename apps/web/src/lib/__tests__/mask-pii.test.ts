import { describe, expect, it } from 'vitest';
import { canViewSensitivePii, maskTaxId } from '../mask-pii';

describe('maskTaxId', () => {
  it('returns null for nullish input', () => {
    expect(maskTaxId(null)).toBeNull();
    expect(maskTaxId(undefined)).toBeNull();
    expect(maskTaxId('')).toBeNull();
  });

  it('masks long tax ids with first 2 and last 2 visible', () => {
    expect(maskTaxId('1234567890')).toBe('12••••••90');
  });

  it('strips whitespace before masking', () => {
    expect(maskTaxId('12 34 56 78 90')).toBe('12••••••90');
  });

  it('returns bullets for short ids (4 or fewer chars after cleaning)', () => {
    expect(maskTaxId('1234')).toBe('••••');
    expect(maskTaxId('12')).toBe('••••');
  });
});

describe('canViewSensitivePii', () => {
  it('returns false for missing or unknown roles', () => {
    expect(canViewSensitivePii(undefined)).toBe(false);
    expect(canViewSensitivePii('')).toBe(false);
    expect(canViewSensitivePii('readonly')).toBe(false);
    expect(canViewSensitivePii('team_manager')).toBe(false);
  });

  it('returns true for privileged finance and admin roles', () => {
    for (const role of [
      'owner',
      'admin',
      'admin',
      'finance_admin',
      'finance_admin',
      'ops_manager',
      'external_accountant',
      'external_accountant',
    ] as const) {
      expect(canViewSensitivePii(role)).toBe(true);
    }
  });
});
