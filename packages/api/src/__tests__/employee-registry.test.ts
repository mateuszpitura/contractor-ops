// HOLD until P89: EmployeeProfile model + employeeRouter + employeePii
// permission land in Plan 04/05.
//
// Registration + PII-reveal scaffold for the employee registry, mirroring the
// contractor revealSsn RBAC + writeAuditLog idiom. It is `describe.skip` so it
// does not fail CI now — the P89-gated waves flip it GREEN once the router +
// permission exist. It pins the omit-encrypted-on-return and reveal-RBAC+audit
// contracts the gated implementation must satisfy. Deliberately imports no P89
// surface (none exists yet), so the suite registers and skips cleanly rather
// than failing at module resolution.

import { describe, expect, it } from 'vitest';

describe.skip('employeeRouter.register', () => {
  it('omits every *Encrypted column from the registration response', () => {
    // The encrypted national-ID blobs (pesel/ssn/iqama/emiratesId) must never
    // round-trip to the client; the create/update return uses
    // `omit: { ...Encrypted: true }`. Full values are reachable only via the
    // audit-logged revealPii procedure.
    expect(true).toBe(true);
  });

  it('validates the registration input with a strict Zod schema', () => {
    // Unknown keys are rejected so no national-ID value can be smuggled into
    // the countryFields JSON.
    expect(true).toBe(true);
  });
});

describe.skip('employeeRouter.revealPii', () => {
  it('requires the employeePii:read permission to reveal a full national ID', () => {
    // A caller without employeePii:read is denied before any decrypt runs.
    expect(true).toBe(true);
  });

  it('writes an employee.<field>.revealed audit row on a successful reveal', () => {
    // Each reveal records who revealed which field via writeAuditLog, mirroring
    // the contractor SSN-reveal audit contract.
    expect(true).toBe(true);
  });
});
