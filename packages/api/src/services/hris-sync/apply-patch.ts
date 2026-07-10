// Apply an HRIS-writable patch to a local worker, tenant-safely and audited.
//
// The function accepts ONLY `HrisWritableEmployeePatch`, so no financial /
// compliance / national-ID column can ever be written — the source-of-truth
// split is enforced at the type boundary here as well as in the projection.
// The target worker is resolved through `ExternalLink` filtered by the caller's
// org; when no link exists the pull attempts an email auto-match and provisions
// a new ExternalLink on first contact. Every write runs on the tenant-scoped db,
// so a record for org A can never touch org B's worker (IDOR fence).

import { createLogger } from '@contractor-ops/logger';
import { isValidNiNumber, isValidSteuerIdNr, isValidSvNummer } from '@contractor-ops/validators';

import type { TenantScopedDb } from '../../lib/tenant-db';
import { writeAuditLog } from '../audit-writer';
import type { HrisWritableEmployeePatch } from './field-partition';
import type { ChangeOrigin } from './sync-hash';

const log = createLogger({ service: 'hris-apply-patch' });

const HRIS_EMPLOYEE_EXTERNAL_TYPE = 'HRIS_EMPLOYEE';

export interface ApplyPatchResult {
  applied: boolean;
  workerId?: string;
  linked?: boolean;
}

export interface ApplyPatchOpts {
  origin: ChangeOrigin;
  integrationConnectionId?: string;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

const NATIONAL_ID_KEYS = ['steuerIdNr', 'svNummer', 'niNumber'] as const;

function coerceNationalIdString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return;
}

/** Drop national-ID countryFields keys that fail market checksum validation. */
function sanitizeCountryFieldsPatch(patch: Record<string, unknown>): {
  sanitized: Record<string, unknown>;
  dropped: string[];
} {
  const sanitized = { ...patch };
  const dropped: string[] = [];

  for (const key of NATIONAL_ID_KEYS) {
    if (!(key in sanitized)) continue;
    const coerced = coerceNationalIdString(sanitized[key]);
    if (coerced === undefined) {
      delete sanitized[key];
      dropped.push(key);
      continue;
    }
    sanitized[key] = coerced;
  }

  if (typeof sanitized.steuerIdNr === 'string' && !isValidSteuerIdNr(sanitized.steuerIdNr)) {
    delete sanitized.steuerIdNr;
    dropped.push('steuerIdNr');
  }
  if (typeof sanitized.svNummer === 'string' && !isValidSvNummer(sanitized.svNummer)) {
    delete sanitized.svNummer;
    dropped.push('svNummer');
  }
  if (typeof sanitized.niNumber === 'string' && !isValidNiNumber(sanitized.niNumber)) {
    delete sanitized.niNumber;
    dropped.push('niNumber');
  }
  return { sanitized, dropped };
}

async function resolveWorkerLink(
  db: TenantScopedDb,
  organizationId: string,
  externalId: string,
  patch: HrisWritableEmployeePatch,
  opts: ApplyPatchOpts,
): Promise<{ workerId: string; linked: boolean } | null> {
  const existing = await db.externalLink.findFirst({
    where: { organizationId, externalId, entityType: { in: ['WORKER', 'EMPLOYEE'] } },
    select: { entityId: true },
  });
  if (existing) return { workerId: existing.entityId, linked: false };

  const email = normalizeEmail(patch.email);
  if (!email) {
    log.debug(
      { organizationId, externalId },
      'hris pull: no ExternalLink and no email for auto-match — skipping',
    );
    return null;
  }
  if (!opts.integrationConnectionId) {
    log.debug(
      { organizationId, externalId },
      'hris pull: no integration connection for auto-match — skipping',
    );
    return null;
  }

  const worker = await db.worker.findFirst({
    where: {
      organizationId,
      workerType: 'EMPLOYEE',
      deletedAt: null,
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (!worker) {
    log.debug(
      { organizationId, externalId, email },
      'hris pull: email auto-match found no local employee — skipping',
    );
    return null;
  }

  const collision = await db.externalLink.findFirst({
    where: {
      organizationId,
      integrationConnectionId: opts.integrationConnectionId,
      entityId: worker.id,
      entityType: { in: ['WORKER', 'EMPLOYEE'] },
    },
    select: { id: true },
  });
  if (collision) {
    log.debug(
      { organizationId, externalId, workerId: worker.id },
      'hris pull: worker already linked to a different HRIS record — skipping',
    );
    return null;
  }

  await db.externalLink.create({
    data: {
      organizationId,
      integrationConnectionId: opts.integrationConnectionId,
      entityType: 'WORKER',
      entityId: worker.id,
      externalType: HRIS_EMPLOYEE_EXTERNAL_TYPE,
      externalId,
    },
  });

  await writeAuditLog({
    organizationId,
    actorType: 'INTEGRATION',
    action: 'hris.employee.linked',
    resourceType: 'WORKER',
    resourceId: worker.id,
    metadata: { externalId, origin: opts.origin, via: 'email-auto-match' },
  });

  return { workerId: worker.id, linked: true };
}

/**
 * Resolve the local worker for a remote record (via ExternalLink or email
 * auto-match) and write only the allowlist fields, merging `countryFieldsPatch`
 * into the existing `EmployeeProfile.countryFields` (CO-owned keys survive).
 * Emits a single INTEGRATION audit row inside the write transaction.
 */
export async function applyPatchToWorker(
  db: TenantScopedDb,
  organizationId: string,
  externalId: string,
  patch: HrisWritableEmployeePatch,
  opts: ApplyPatchOpts,
): Promise<ApplyPatchResult> {
  const resolved = await resolveWorkerLink(db, organizationId, externalId, patch, opts);
  if (!resolved) return { applied: false };

  const { workerId, linked } = resolved;

  const workerData: { displayName?: string; email?: string | null } = {};
  if (patch.displayName !== undefined) workerData.displayName = patch.displayName;
  if (patch.email !== undefined) workerData.email = patch.email;

  const profileData: {
    employmentStatus?: string;
    etat?: string | null;
    terminatedAt?: Date | null;
  } = {};
  if (patch.employmentStatus !== undefined) profileData.employmentStatus = patch.employmentStatus;
  if (patch.etat !== undefined) profileData.etat = patch.etat;

  const hireDate = toDate(patch.hireDate);
  const terminatedAt = toDate(patch.terminatedAt);
  const fileData: { hireDate?: Date | null; terminatedAt?: Date | null } = {};
  if (hireDate !== undefined) fileData.hireDate = hireDate;
  if (terminatedAt !== undefined) fileData.terminatedAt = terminatedAt;
  if (terminatedAt !== undefined) {
    profileData.terminatedAt = terminatedAt;
    if (terminatedAt !== null) profileData.employmentStatus = 'TERMINATED';
  }

  const hasWorkerWrite = Object.keys(workerData).length > 0;
  const hasProfileWrite =
    Object.keys(profileData).length > 0 || patch.countryFieldsPatch !== undefined;
  const hasFileWrite = Object.keys(fileData).length > 0;

  if (!(hasWorkerWrite || hasProfileWrite || hasFileWrite)) {
    return { applied: false, workerId, linked };
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
        const { sanitized, dropped } = sanitizeCountryFieldsPatch(patch.countryFieldsPatch);
        if (dropped.length > 0) {
          log.warn(
            { organizationId, workerId, externalId, dropped },
            'hris pull: dropped invalid countryFields keys',
          );
          await writeAuditLog({
            organizationId,
            actorType: 'INTEGRATION',
            action: 'hris.pull.country_fields_dropped',
            resourceType: 'WORKER',
            resourceId: workerId,
            metadata: { externalId, origin: opts.origin, dropped },
            tx,
          });
        }
        data.countryFields = { ...priorCountryFields, ...sanitized };
      }
      await tx.employeeProfile.update({ where: { workerId }, data });
    }

    if (hasFileWrite) {
      const [profile, org] = await Promise.all([
        tx.employeeProfile.findFirst({
          where: { workerId, organizationId },
          select: { countryCode: true },
        }),
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { countryCode: true },
        }),
      ]);
      const countryCode = profile?.countryCode ?? org?.countryCode;
      if (countryCode) {
        await tx.personnelFile.upsert({
          where: { workerId },
          create: {
            organizationId,
            workerId,
            countryCode,
            ...fileData,
          },
          update: fileData,
        });
      } else {
        log.warn(
          { organizationId, workerId },
          'hris.apply: skipping personnel file write — no employee or org countryCode',
        );
      }
    }

    await writeAuditLog({
      organizationId,
      actorType: 'INTEGRATION',
      action: 'hris.pull.apply',
      resourceType: 'WORKER',
      resourceId: workerId,
      metadata: { externalId, origin: opts.origin, linked },
      tx,
    });
  });

  return { applied: true, workerId, linked };
}
