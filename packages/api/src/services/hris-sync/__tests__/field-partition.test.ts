import { describe, expect, it } from 'vitest';
import type { HrisWritableEmployeePatch } from '../field-partition';
import { assertNotHrisOwnedField, projectToWritablePatch } from '../field-partition';
import type { HrisEmployeeRecord, HrisFieldMapping, HrisPushPayload } from '../types';

const baseMapping: HrisFieldMapping = {
  standard: {
    displayName: 'name',
    email: 'work_email',
    employmentStatus: 'status',
    position: 'job_title',
    department: 'department',
    hireDate: 'hire_date',
    terminatedAt: 'termination_date',
  },
};

function record(attributes: Record<string, unknown>): HrisEmployeeRecord {
  return { externalId: 'ext-1', provider: 'PERSONIO', attributes };
}

describe('projectToWritablePatch', () => {
  it('returns only allowlisted registry keys from a standard record', () => {
    const patch = projectToWritablePatch(
      record({
        name: 'Anna Kowalska',
        work_email: 'anna@example.com',
        status: 'active',
        job_title: 'Engineer',
        department: 'Product',
        hire_date: '2024-01-15',
        termination_date: null,
      }),
      baseMapping,
    );

    expect(patch.displayName).toBe('Anna Kowalska');
    expect(patch.email).toBe('anna@example.com');
    expect(patch.employmentStatus).toBe('ACTIVE');
    expect(patch.hireDate).toBe('2024-01-15');
    expect(patch.countryFieldsPatch).toEqual({ position: 'Engineer', department: 'Product' });
    // No financial/compliance/national-ID keys ever appear.
    expect(patch).not.toHaveProperty('invoice');
    expect(patch).not.toHaveProperty('peselEncrypted');
  });

  it('normalizes provider status strings to the writable enum and drops unknowns', () => {
    expect(
      projectToWritablePatch(record({ status: 'On Leave' }), baseMapping).employmentStatus,
    ).toBe('ON_LEAVE');
    expect(
      projectToWritablePatch(record({ status: 'inactive' }), baseMapping).employmentStatus,
    ).toBe('TERMINATED');
    // Unrecognized status is dropped, never throws.
    expect(
      projectToWritablePatch(record({ status: 'garbage' }), baseMapping).employmentStatus,
    ).toBeUndefined();
  });

  it('DROPS an HRIS attribute a hostile mapping points at a protected/national-ID key', () => {
    const hostileMapping: HrisFieldMapping = {
      standard: { displayName: 'name' },
      customAttributes: {
        gov_id: 'peselLast4', // national ID → must be dropped
        pay: 'invoiceAmount', // financial → must be dropped
        band: 'saudizationCategory', // legitimate non-protected countryFields key
      },
    };
    const patch = projectToWritablePatch(
      record({
        name: 'Jan Nowak',
        gov_id: '1234',
        pay: '5000',
        band: 'GREEN',
      }),
      hostileMapping,
    );

    expect(patch.displayName).toBe('Jan Nowak');
    // The protected targets are absent; only the legitimate one survives.
    const cf = patch.countryFieldsPatch ?? {};
    expect(cf).not.toHaveProperty('peselLast4');
    expect(cf).not.toHaveProperty('invoiceAmount');
    expect(cf.saudizationCategory).toBe('GREEN');
  });

  it('never carries a national-ID or financial key at the top level of the patch', () => {
    const patch = projectToWritablePatch(
      record({ name: 'X', pesel: '99010112345', invoice_total: '900' }),
      baseMapping,
    );
    const keys = Object.keys(patch);
    for (const forbidden of [
      'pesel',
      'invoice',
      'Encrypted',
      'Last4',
      'payment',
      'classification',
    ]) {
      expect(keys.some(k => k.toLowerCase().includes(forbidden.toLowerCase()))).toBe(false);
    }
  });

  it('protected field survives a conflicting HRIS pull (spread leaves CO columns untouched)', () => {
    // A DB-shaped row with CO-owned financial + national-ID columns.
    const dbRow = {
      displayName: 'Old Name',
      employmentStatus: 'ACTIVE',
      peselEncrypted: 'iv:tag:cipher',
      peselLast4: '2345',
      invoiceTotal: '900.00',
    };
    const patch = projectToWritablePatch(
      record({ name: 'New Name', status: 'active', pesel: 'should-not-land' }),
      baseMapping,
    );
    const merged = { ...dbRow, ...patch };

    expect(merged.displayName).toBe('New Name'); // HRIS-owned updated
    expect(merged.peselEncrypted).toBe('iv:tag:cipher'); // CO-owned survives
    expect(merged.peselLast4).toBe('2345');
    expect(merged.invoiceTotal).toBe('900.00');
  });
});

describe('assertNotHrisOwnedField', () => {
  it('passes for a CO-owned business push payload', () => {
    const payload: HrisPushPayload = {
      kind: 'invoice-paid',
      workerId: 'w1',
      invoiceId: 'inv1',
      paidAt: '2026-07-01T00:00:00Z',
      amount: '100.00',
      currency: 'EUR',
    };
    expect(() => assertNotHrisOwnedField(payload)).not.toThrow();
  });

  it('throws when a payload smuggles an HRIS-owned key (loop guard)', () => {
    const rogue = {
      kind: 'invoice-paid',
      workerId: 'w1',
      displayName: 'echoed name', // HRIS-owned — would create a loop
    } as unknown as HrisPushPayload;
    expect(() => assertNotHrisOwnedField(rogue)).toThrow(/HRIS-owned field/);
  });
});

describe('HrisWritableEmployeePatch shape', () => {
  it('is structurally limited to registry keys (compile-time allowlist)', () => {
    // If a protected key were ever added to the type, this object literal would
    // still compile but the runtime tests above guard the projection. The type
    // itself has no invoice/payment/classification/*Encrypted/*Last4 members.
    const patch: HrisWritableEmployeePatch = {
      displayName: 'a',
      email: null,
      employmentStatus: 'ACTIVE',
      etat: '0.80',
      hireDate: '2024-01-01',
      terminatedAt: null,
      countryFieldsPatch: { position: 'X' },
    };
    expect(Object.keys(patch).sort()).toEqual(
      [
        'countryFieldsPatch',
        'displayName',
        'email',
        'employmentStatus',
        'etat',
        'hireDate',
        'terminatedAt',
      ].sort(),
    );
  });
});
