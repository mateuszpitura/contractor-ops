// Server-side reporting-line scope for the employee-portal manager surface.
//
// A portal manager is NOT a staff approver — their authority is the reporting
// line, resolved from the reports edge on `EmployeeProfile.managerWorkerId`.
// Both helpers derive the report set from the passed manager identity (the
// caller passes ctx.workerId / ctx.organizationId from the SESSION), never from
// client input, so a manager can only see and act on their own direct reports.

import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import type { TenantScopedDb } from '../lib/tenant-db';

export interface DirectReport {
  workerId: string;
  displayName: string | null;
}

/**
 * The caller's direct reports — every `EmployeeProfile` whose `managerWorkerId`
 * is the manager, within the manager's own org. Report ids are the profiles'
 * own `workerId`, never a client-supplied value.
 */
export async function resolveDirectReports(
  db: TenantScopedDb,
  managerWorkerId: string,
  organizationId: string,
): Promise<DirectReport[]> {
  const profiles = await db.employeeProfile.findMany({
    where: { managerWorkerId, organizationId },
    select: { workerId: true, worker: { select: { displayName: true } } },
    orderBy: { workerId: 'asc' },
  });
  return profiles.map(profile => ({
    workerId: profile.workerId,
    displayName: profile.worker?.displayName ?? null,
  }));
}

/**
 * Assert `targetWorkerId` is one of the manager's direct reports, throwing
 * FORBIDDEN otherwise. Runs BEFORE any read of the target's data or any state
 * change. Same-org is enforced here because the `managerWorkerId` reference is
 * deliberately not an FK (org-scoped worker rows), so a cross-org edge could
 * otherwise slip through — the `organizationId` predicate closes that.
 */
export async function assertIsDirectReport(
  db: TenantScopedDb,
  managerWorkerId: string,
  organizationId: string,
  targetWorkerId: string,
): Promise<void> {
  const report = await db.employeeProfile.findFirst({
    where: { workerId: targetWorkerId, managerWorkerId, organizationId },
    select: { workerId: true },
  });
  if (!report) {
    throw new TRPCError({ code: 'FORBIDDEN', message: E.PORTAL_NOT_A_DIRECT_REPORT });
  }
}
