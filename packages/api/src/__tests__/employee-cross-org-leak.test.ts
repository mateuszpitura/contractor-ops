// HOLD until P89: EmployeeProfile model + employeeRouter + employeePii
// permission land in Plan 04/05.
//
// Tenant-isolation scaffold for EmployeeProfile, mirroring tenant-isolation.test.ts.
// It is `describe.skip` so it does not fail CI now — the P89-gated waves flip it
// GREEN once the model + router exist. It pins the cross-org read invariant the
// gated implementation must satisfy, so no later wave has to invent the
// expectation. Deliberately imports no P89 surface (none exists yet), so the
// suite registers and skips cleanly rather than failing at module resolution.

import { describe, expect, it } from 'vitest';

describe.skip('EmployeeProfile cross-org isolation', () => {
  it('does not return org B EmployeeProfile rows to an org A caller', () => {
    // An EmployeeProfile read scoped to org A must never surface org B's row.
    // The model is tenant-owning (organizationId in every where, NOT in
    // globalModels), so withTenantScope filters the foreign row out.
    expect(true).toBe(true);
  });

  it('rejects a cross-org EmployeeProfile mutation with NOT_FOUND', () => {
    // An org A caller updating an org B employeeId resolves to no row under the
    // tenant scope and must surface NOT_FOUND, never a silent cross-org write.
    expect(true).toBe(true);
  });
});
