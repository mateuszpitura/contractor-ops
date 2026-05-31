// Phase 73 · Plan 03 — Permission registration test (D-10).

import { describe, expect, it } from 'vitest';
import { accessControlStatement } from '../permissions.js';
import { roles } from '../roles.js';

type RoleStatements = { statements: Record<string, string[] | undefined> };

describe('compliance-permission resource', () => {
  it('accessControlStatement.compliance includes "read" and "override" actions', () => {
    expect(accessControlStatement.compliance).toContain('read');
    expect(accessControlStatement.compliance).toContain('override');
  });
});

describe('compliance-permission roles', () => {
  it('owner role has compliance:read AND compliance:override', () => {
    const owner = roles.owner as unknown as RoleStatements;
    expect(owner.statements?.compliance).toContain('read');
    expect(owner.statements?.compliance).toContain('override');
  });

  it('admin role has compliance:read AND compliance:override', () => {
    const admin = roles.admin as unknown as RoleStatements;
    expect(admin.statements?.compliance).toContain('read');
    expect(admin.statements?.compliance).toContain('override');
  });

  it('finance_admin role has compliance:read but NOT compliance:override', () => {
    const role = roles.finance_admin as unknown as RoleStatements;
    expect(role.statements?.compliance).toContain('read');
    expect(role.statements?.compliance).not.toContain('override');
  });

  it('legal_compliance_viewer role has compliance:read', () => {
    const role = roles.legal_compliance_viewer as unknown as RoleStatements;
    expect(role.statements?.compliance).toContain('read');
  });

  it('platform_operator role has NEITHER compliance:read NOR compliance:override (cross-tenant isolation)', () => {
    const role = roles.platform_operator as unknown as RoleStatements;
    expect(role.statements?.compliance).toBeUndefined();
  });
});
