// Asserts the workflow:override_blocking_task action is granted to OWNER ONLY.
// CI fails immediately if any future role-table edit accidentally widens the
// grant to a non-owner role.

import { describe, expect, it } from 'vitest';
import { roles } from '../roles.js';

const ALL_ROLE_NAMES = [
  'owner',
  'admin',
  'finance_admin',
  'ops_manager',
  'team_manager',
  'legal_compliance_viewer',
  'it_admin',
  'external_accountant',
  'readonly',
  'platform_operator',
] as const;

type RoleName = (typeof ALL_ROLE_NAMES)[number];

function workflowActionsFor(name: RoleName): readonly string[] {
  const role = roles[name as keyof typeof roles] as
    | { statements?: { workflow?: readonly string[] } }
    | undefined;
  return role?.statements?.workflow ?? [];
}

describe('workflow:override_blocking_task — OWNER-only', () => {
  it.each(
    ALL_ROLE_NAMES,
  )('role %s — override_blocking_task grant matches owner-only invariant', roleName => {
    const role = roles[roleName as keyof typeof roles];
    expect(role, `role ${roleName} must be exported from roles.ts`).toBeDefined();
    const granted = workflowActionsFor(roleName).includes('override_blocking_task');
    if (roleName === 'owner') {
      expect(granted, 'owner role MUST grant override_blocking_task').toBe(true);
    } else {
      expect(granted, `role ${roleName} MUST NOT grant override_blocking_task`).toBe(false);
    }
  });

  it('exactly one role grants override_blocking_task (owner-only regression guard)', () => {
    const granters = ALL_ROLE_NAMES.filter(name =>
      workflowActionsFor(name).includes('override_blocking_task'),
    );
    expect(granters).toEqual(['owner']);
  });
});
