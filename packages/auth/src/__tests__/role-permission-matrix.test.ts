/**
 * Complete role × resource authorization matrix.
 *
 * `roles.test.ts` proves owner and admin span the full statement and spot-checks
 * the remaining roles. This suite closes the "...and NOTHING more" half of the
 * invariant for every one of the 10 platform roles: each role's granted
 * statement must equal its documented spec EXACTLY — same resource keys, same
 * action sets, no extra resource, no extra action.
 *
 * The expected matrix below is the single source of truth a reviewer reads to
 * answer "what can role X do?". A drift in roles.ts (a permission silently added
 * or dropped) fails here with the exact resource that diverged.
 */
import { describe, expect, it } from 'vitest';
import type { RoleName } from '../roles.js';
import { roles } from '../roles.js';

/** Documented permission set per role — must mirror roles.ts exactly. */
const EXPECTED: Record<RoleName, Record<string, readonly string[]>> = {
  owner: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    compliance: ['read', 'override'],
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
    idp: ['override_step_failure', 'start_run'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
    contractorPii: ['read'],
  },
  admin: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    compliance: ['read', 'override'],
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    idp: ['override_step_failure', 'start_run'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
    contractorPii: ['read'],
  },
  finance_admin: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
    contractorPii: ['read'],
  },
  ops_manager: {
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    compliance: ['read'],
    invoice: ['create', 'read', 'update'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  team_manager: {
    contractor: ['read', 'update'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read', 'approve'],
    workflow: ['read', 'execute'],
    report: ['read'],
    time: ['read', 'approve'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  legal_compliance_viewer: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  it_admin: {
    member: ['create', 'read', 'update'],
    invitation: ['create', 'cancel'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    idp: ['start_run'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  external_accountant: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    payment: ['read'],
    report: ['read', 'export'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  readonly: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    workflow: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  platform_operator: {
    'admin:boe-rate': ['read', 'write'],
  },
};

const sorted = (a: readonly string[]) => [...a].sort();

describe('role × resource permission matrix — exact grant per role', () => {
  for (const roleName of Object.keys(EXPECTED) as RoleName[]) {
    const expected = EXPECTED[roleName];

    describe(roleName, () => {
      const statements = roles[roleName].statements as Record<
        string,
        readonly string[] | undefined
      >;

      it('grants exactly the documented resource keys (no extra resource)', () => {
        expect(Object.keys(statements).sort()).toEqual(Object.keys(expected).sort());
      });

      for (const [resource, actions] of Object.entries(expected)) {
        it(`grants exactly [${[...actions].sort().join(', ')}] on ${resource}`, () => {
          expect(statements[resource]).toBeDefined();
          expect(sorted(statements[resource] ?? [])).toEqual(sorted(actions));
        });
      }
    });
  }

  it('only platform_operator holds admin:boe-rate; no per-org role does', () => {
    for (const [name, role] of Object.entries(roles)) {
      const statements = role.statements as Record<string, readonly string[] | undefined>;
      if (name === 'platform_operator') {
        expect(statements['admin:boe-rate']).toEqual(['read', 'write']);
      } else {
        expect(statements['admin:boe-rate']).toBeUndefined();
      }
    }
  });

  it('platform_operator holds no tenant-facing resource (cannot touch customer data)', () => {
    const tenantResources = ['contractor', 'contract', 'invoice', 'payment', 'document', 'member'];
    const statements = roles.platform_operator.statements as Record<string, unknown>;
    for (const resource of tenantResources) {
      expect(statements[resource]).toBeUndefined();
    }
  });
});
