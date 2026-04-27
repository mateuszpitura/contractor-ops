// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — resolveRbacRecipients tests.
// ---------------------------------------------------------------------------
//
// Verifies that the rbac-recipients helper:
//   a) returns users whose role grants contractor:read,
//   b) excludes users whose role does NOT grant it,
//   c) never leaks users from another organisation,
//   d) dedupes multiple Member rows for the same user,
//   e) mirrors the Better Auth role→permission mapping from
//      packages/auth/src/roles.ts (snapshot-style).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock('@contractor-ops/db', () => ({
  prisma: {}, // stubbed — @contractor-ops/auth/config.ts imports this at module init
  prismaRaw: {
    member: {
      findMany: mockFindMany,
    },
  },
}));

// Imported AFTER the db mock so better-auth's adapter init doesn't crash.
import { roles as authRoles } from '@contractor-ops/auth';

import { resolveRbacRecipients, __testables as testables } from '../rbac-recipients.js';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';

describe('resolveRbacRecipients', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('returns user ids whose role grants contractor:read', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'user-owner', role: 'owner' },
      { userId: 'user-admin', role: 'admin' },
      { userId: 'user-readonly', role: 'readonly' },
    ]);
    const ids = await resolveRbacRecipients(ORG_A, 'contractor:read');
    expect(new Set(ids)).toEqual(new Set(['user-owner', 'user-admin', 'user-readonly']));
  });

  it('excludes users whose role does NOT grant contractor:read', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'user-admin', role: 'admin' },
      { userId: 'user-it', role: 'it_admin' }, // it_admin has no contractor scope
    ]);
    const ids = await resolveRbacRecipients(ORG_A, 'contractor:read');
    expect(ids).toEqual(['user-admin']);
  });

  it('returns only users whose role grants contractor:update for the update permission', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'user-owner', role: 'owner' }, // can update
      { userId: 'user-finance', role: 'finance_admin' }, // read-only
      { userId: 'user-ops', role: 'ops_manager' }, // can update
      { userId: 'user-readonly', role: 'readonly' }, // read-only
    ]);
    const ids = await resolveRbacRecipients(ORG_A, 'contractor:update');
    expect(new Set(ids)).toEqual(new Set(['user-owner', 'user-ops']));
  });

  it('scopes the prisma query by organizationId — no cross-org leak', async () => {
    mockFindMany.mockResolvedValue([]);
    await resolveRbacRecipients(ORG_A, 'contractor:read');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_A } }),
    );
    // Also sanity-check it was called with Org A, not Org B.
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.organizationId).toBe(ORG_A);
    expect(call.where.organizationId).not.toBe(ORG_B);
  });

  it('dedupes repeated userId rows (e.g. two active roles for the same user)', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'user-dup', role: 'admin' },
      { userId: 'user-dup', role: 'finance_admin' },
    ]);
    const ids = await resolveRbacRecipients(ORG_A, 'contractor:read');
    expect(ids).toEqual(['user-dup']);
  });

  it('returns an empty array when no member has the permission', async () => {
    mockFindMany.mockResolvedValue([{ userId: 'user-it', role: 'it_admin' }]);
    const ids = await resolveRbacRecipients(ORG_A, 'contractor:read');
    expect(ids).toEqual([]);
  });

  it('snapshot-asserts ROLE_CONTRACTOR_ACTIONS against the real Better Auth role statements', () => {
    // If this fails, someone edited packages/auth/src/roles.ts without
    // updating the local mirror. Fix rbac-recipients.ts and re-run.
    const expected: Record<string, string[]> = {};
    for (const [name, role] of Object.entries(authRoles)) {
      const actions = (role.statements as Record<string, readonly string[]>).contractor ?? [];
      expected[name] = actions.filter(a => a === 'read' || a === 'update').sort();
    }
    const actual: Record<string, string[]> = {};
    for (const [name, actions] of Object.entries(testables.ROLE_CONTRACTOR_ACTIONS)) {
      actual[name] = Array.from(actions).sort();
    }
    expect(actual).toEqual(expected);
  });
});
