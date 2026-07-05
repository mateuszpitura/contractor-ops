// Apply an HRIS-writable patch to a local worker, tenant-safely and audited.
//
// The function accepts ONLY `HrisWritableEmployeePatch`, so no financial /
// compliance / national-ID column can ever be written — the source-of-truth
// split is enforced at the type boundary here as well as in the projection.
// The target worker is resolved through `ExternalLink` filtered by the caller's
// org, and every write runs on the tenant-scoped db, so a record for org A can
// never touch org B's worker (IDOR fence). A record with no ExternalLink is a
// no-op (a new remote employee is surfaced, not auto-provisioned).

import { createLogger } from '@contractor-ops/logger';

import type { TenantScopedDb } from '../../lib/tenant-db';
import { writeAuditLog } from '../audit-writer';
import type { HrisWritableEmployeePatch } from './field-partition';
import type { ChangeOrigin } from './sync-hash';

const log = createLogger({ service: 'hris-apply-patch' });

export interface ApplyPatchResult {
  applied: boolean;
  workerId?: string;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Resolve the local worker for a remote record (via ExternalLink, org-scoped)
 * and write only the allowlist fields, merging `countryFieldsPatch` into the
 * existing `EmployeeProfile.countryFields` (CO-owned keys survive). Emits a
 * single INTEGRATION audit row inside the write transaction.
 */
export async function applyPatchToWorker(
  db: TenantScopedDb,
  organizationId: string,
  externalId: string,
  patch: HrisWritableEmployeePatch,
  opts: { origin: ChangeOrigin },
): Promise<ApplyPatchResult> {
  const link = await db.externalLink.findFirst({
    where: { organizationId, externalId, entityType: { in: ['WORKER', 'EMPLOYEE'] } },
    select: { entityId: true },
  });

  if (!link) {
    log.debug(
      { organizationId, externalId },
      'hris pull: no ExternalLink for remote record — skipping',
    );
    return { applied: false };
  }

  const workerId = link.entityId;

  const workerData: { displayName?: string; email?: string | null } = {};
  if (patch.displayName !== undefined) workerData.displayName = patch.displayName;
  if (patch.email !== undefined) workerData.email = patch.email;

  const profileData: { employmentStatus?: string; etat?: string | null } = {};
  if (patch.employmentStatus !== undefined) profileData.employmentStatus = patch.employmentStatus;
  if (patch.etat !== undefined) profileData.etat = patch.etat;

  const hireDate = toDate(patch.hireDate);
  const terminatedAt = toDate(patch.terminatedAt);
  const fileData: { hireDate?: Date | null; terminatedAt?: Date | null } = {};
  if (hireDate !== undefined) fileData.hireDate = hireDate;
  if (terminatedAt !== undefined) fileData.terminatedAt = terminatedAt;

  const hasWorkerWrite = Object.keys(workerData).length > 0;
  const hasProfileWrite =
    Object.keys(profileData).length > 0 || patch.countryFieldsPatch !== undefined;
  const hasFileWrite = Object.keys(fileData).length > 0;

  if (!(hasWorkerWrite || hasProfileWrite || hasFileWrite)) {
    return { applied: false, workerId };
  }

  await db.$transaction(async tx => {
    if (hasWorkerWrite) {
      await tx.worker.update({ where: { id: workerId }, data: workerData });
    }

    if (hasProfileWrite) {
      const data: Record<string, unknown> = { ...profileData };
      if (patch.countryFieldsPatch !== undefined) {
        const existing = await tx.employeeProfile.findFirst({
          where: { workerId },
          select: { countryFields: true },
        });
        const priorCountryFields =
          existing?.countryFields && typeof existing.countryFields === 'object'
            ? (existing.countryFields as Record<string, unknown>)
            : {};
        // Merge, never replace — CO-owned countryFields keys survive an HRIS pull.
        data.countryFields = { ...priorCountryFields, ...patch.countryFieldsPatch };
      }
      await tx.employeeProfile.update({ where: { workerId }, data });
    }

    if (hasFileWrite) {
      await tx.personnelFile.update({ where: { workerId }, data: fileData });
    }

    await writeAuditLog({
      organizationId,
      actorType: 'INTEGRATION',
      action: 'hris.pull.apply',
      resourceType: 'WORKER',
      resourceId: workerId,
      metadata: { externalId, origin: opts.origin },
      tx,
    });
  });

  return { applied: true, workerId };
}
