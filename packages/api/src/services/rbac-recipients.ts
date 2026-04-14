// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — RBAC recipient lookup for notification dispatch.
// ---------------------------------------------------------------------------
//
// Bulk variant of `requirePermission` used when a cron job needs to dispatch
// notifications to every org member that holds a given permission (contractor
// read/update etc.). The tRPC middleware checks one user at a time; here we
// iterate the Member table and filter locally against the Better Auth role
// definitions (packages/auth/src/roles.ts — the single source of truth).
//
// Security contract:
//   - The query scopes by organizationId (never leaves a single tenant).
//   - The role→permission mapping mirrors roles.ts EXACTLY; a unit test in
//     __tests__/rbac-recipients.test.ts asserts the mapping.
//   - Runs under `prismaRaw` (no tenant extension) because the caller is the
//     cron scheduler, which runs OUTSIDE any AsyncLocalStorage tenant frame.
//     We re-assert tenant isolation by passing organizationId explicitly into
//     the where-clause.
//
// Open Question #3 (60-CONTEXT.md) — resolved: this helper is the single
// source of truth for "which users in org X can see contractor:read?".

import { prismaRaw } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Role → permissions mapping (mirrors packages/auth/src/roles.ts).
// Kept as a literal here — not imported — so the auth package doesn't need to
// export its role statements and so that tests can assert the snapshot.
// ---------------------------------------------------------------------------

type ContractorAction = 'read' | 'update';

// Hand-mirrored from packages/auth/src/roles.ts. Any edit there MUST also
// update this map; rbac-recipients.test.ts snapshots the mapping to catch
// drift.
const ROLE_CONTRACTOR_ACTIONS: Record<string, readonly ContractorAction[]> = {
  owner: ['read', 'update'],
  admin: ['read', 'update'],
  finance_admin: ['read'],
  ops_manager: ['read', 'update'],
  team_manager: ['read', 'update'],
  legal_compliance_viewer: ['read'],
  it_admin: [],
  external_accountant: ['read'],
  readonly: ['read'],
};

function roleGrants(role: string, action: ContractorAction): boolean {
  const normalised = role.toLowerCase();
  const grants = ROLE_CONTRACTOR_ACTIONS[normalised];
  return grants ? grants.includes(action) : false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ContractorPermission = 'contractor:read' | 'contractor:update';

/**
 * Returns the deduped list of user ids in `organizationId` whose active
 * Member role grants the requested contractor permission.
 *
 * Used by cron jobs (Phase 60 CLASS-07 economic-dependency scan) to resolve
 * "everyone in org X who can see this contractor" for notification fan-out.
 *
 * - Never returns members from other organisations (explicit where-scope).
 * - Dedupes by userId in case a user has multiple Member rows.
 * - Returns an empty array (not null) when no role grants the permission.
 */
export async function resolveRbacRecipients(
  organizationId: string,
  permission: ContractorPermission,
): Promise<string[]> {
  const action: ContractorAction = permission === 'contractor:update' ? 'update' : 'read';

  // PHASE-60-CROSS-ORG-AGGREGATE: cron runs outside any tenant frame, so use
  // the raw client with an explicit organizationId filter to stay inside the
  // requested tenant.
  const members = await prismaRaw.member.findMany({
    where: { organizationId },
    select: { userId: true, role: true },
  });

  const userIds = new Set<string>();
  for (const m of members) {
    if (roleGrants(m.role, action)) {
      userIds.add(m.userId);
    }
  }

  return Array.from(userIds);
}

// Exported for testing — lets the test snapshot the mapping to catch drift
// against packages/auth/src/roles.ts.
export const __testables = { ROLE_CONTRACTOR_ACTIONS, roleGrants };
