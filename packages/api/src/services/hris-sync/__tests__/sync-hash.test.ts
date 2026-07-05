import { describe, expect, it } from 'vitest';

import type { HrisWritableEmployeePatch } from '../field-partition';
import { syncHash } from '../sync-hash';

describe('syncHash', () => {
  it('is key-order-independent (equal patches hash equal regardless of insertion order)', () => {
    const a: HrisWritableEmployeePatch = {
      displayName: 'A',
      email: 'a@x.com',
      employmentStatus: 'ACTIVE',
    };
    const b: HrisWritableEmployeePatch = {};
    b.employmentStatus = 'ACTIVE';
    b.email = 'a@x.com';
    b.displayName = 'A';
    expect(syncHash(a)).toBe(syncHash(b));
  });

  it('is stable across nested countryFieldsPatch key order', () => {
    const a: HrisWritableEmployeePatch = {
      displayName: 'A',
      countryFieldsPatch: { position: 'Eng', department: 'Product' },
    };
    const b: HrisWritableEmployeePatch = {
      countryFieldsPatch: { department: 'Product', position: 'Eng' },
      displayName: 'A',
    };
    expect(syncHash(a)).toBe(syncHash(b));
  });

  it('changes when any value changes', () => {
    const base: HrisWritableEmployeePatch = { displayName: 'A', employmentStatus: 'ACTIVE' };
    const changed: HrisWritableEmployeePatch = { displayName: 'A', employmentStatus: 'TERMINATED' };
    expect(syncHash(base)).not.toBe(syncHash(changed));
  });

  it('hashes an empty patch stably', () => {
    expect(syncHash({})).toBe(syncHash({}));
    expect(syncHash({})).toMatch(/^[0-9a-f]{64}$/);
  });

  it('supports the skip-when-equal idempotency contract', () => {
    const stored: HrisWritableEmployeePatch = { displayName: 'A', hireDate: '2024-01-01' };
    const incoming: HrisWritableEmployeePatch = { hireDate: '2024-01-01', displayName: 'A' };
    // An unchanged snapshot hashes equal → the pull skips the write.
    expect(syncHash(incoming) === syncHash(stored)).toBe(true);
  });
});
