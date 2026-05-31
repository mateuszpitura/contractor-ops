// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-01 permission registration (D-10);
// resource added in packages/auth/src/permissions.ts (Plan 73-03).

import { describe, expect, it } from 'vitest';

describe('compliance-permission resource', () => {
  it('accessControlStatement.compliance includes "read" and "override" actions', async () => {
    const mod = await import('../permissions.js');
    const stmt = (mod.accessControlStatement as Record<string, readonly string[]>).compliance;
    expect(stmt, 'compliance resource not declared in accessControlStatement').toBeDefined();
    expect(stmt).toContain('read');
    expect(stmt).toContain('override');
  });
});

describe('compliance-permission roles', () => {
  it('owner role has compliance:read AND compliance:override', async () => {
    const mod = await import('../roles.js');
    // @ts-expect-error — runtime access; compliance key not yet in role types
    expect(mod.roles.owner.statements?.compliance).toContain('override');
  });

  it('admin role has compliance:read AND compliance:override', async () => {
    throw new Error('admin role grant not yet implemented');
  });

  it('finance_admin role has compliance:read but NOT compliance:override', async () => {
    throw new Error('finance_admin grant not yet implemented');
  });

  it('legal_compliance_viewer role has compliance:read', async () => {
    throw new Error('legal_compliance_viewer grant not yet implemented');
  });

  it('platform_operator role has NEITHER compliance:read NOR compliance:override (cross-tenant isolation)', async () => {
    throw new Error('platform_operator exclusion not yet implemented');
  });
});
