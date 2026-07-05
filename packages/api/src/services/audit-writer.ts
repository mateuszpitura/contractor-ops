// ---------------------------------------------------------------------------
// Shared AuditLog writer.
// ---------------------------------------------------------------------------
//
// ContractorAssignment + Contract mutations previously did NOT emit AuditLog
// rows. This helper is the single write path used by contractor/contract/
// reassessment routers so the daily reassessment scan has an auditable event
// stream to walk.
//
// Security contract:
//   - The caller MUST supply organizationId (no implicit tenant lookup).
//   - When invoked inside a router mutation, callers pass `tx` so the audit
//     row commits/rolls back atomically with the business mutation.
//   - NO console.* — uses @contractor-ops/logger per CLAUDE.md.
//   - Accepts ONLY `create`. Updates and deletes on AuditLog are forbidden
//     (audit is append-only per audit.prisma contract).

import type { Prisma } from '@contractor-ops/db';
import { getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'audit-writer' });

/** Mirrors @contractor-ops/db ActorType Prisma enum. */
export type AuditActorType =
  | 'USER'
  | 'SYSTEM'
  | 'INTEGRATION'
  | 'API_KEY'
  | 'CONTRACTOR'
  | 'EMPLOYEE';

/** Mirrors EntityType enum in contract.prisma — only the subset this helper accepts. */
export type AuditEntityType =
  | 'ORGANIZATION'
  | 'CONTRACTOR'
  | 'CONTRACT'
  | 'DOCUMENT'
  | 'INVOICE'
  | 'WORKFLOW_RUN'
  | 'WORKFLOW_TASK_RUN'
  | 'PAYMENT_RUN'
  | 'PROJECT'
  | 'TEAM'
  | 'APPROVAL_FLOW'
  | 'TIMESHEET'
  | 'EQUIPMENT'
  | 'SHIPMENT'
  | 'USER'
  | 'RETURN_REQUEST'
  | 'LEAVE_REQUEST'
  | 'EMPLOYEE_TIME_RECORD'
  | 'EWIDENCJA_SNAPSHOT'
  | 'WORKER'
  | 'EMPLOYEE'
  | 'WEBHOOK_SUBSCRIPTION'
  | 'MARKETPLACE_LISTING'
  | 'INCIDENT';

/**
 * Thin shape accepted for `tx` — any Prisma client (base or transactional)
 * that exposes `auditLog.create` / `auditLog.createMany` suffices. We keep it
 * structural so both the tenant-extended client and raw `$transaction` tx
 * accept cleanly.
 */
export interface AuditWriterClient {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.AuditLogUncheckedCreateInput[];
    }) => Promise<{ count: number }>;
  };
}

export interface WriteAuditLogInput {
  organizationId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  resourceType: AuditEntityType;
  resourceId: string;
  resourceName?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * Explicit data region for the org. When omitted the region is resolved from
   * the active tenant context (AsyncLocalStorage) and, failing that, the global
   * Organization directory. Ignored when `tx` is supplied (the tx is already
   * pinned to a region). Provide it explicitly only from contexts that have no
   * tenant context to lean on.
   */
  region?: string;
  /** Optional Prisma transaction client — when supplied the insert joins the caller's transaction. */
  tx?: AuditWriterClient;
}

/**
 * Resolves the Prisma client the audit row must be written through.
 *
 * When the caller supplies `tx` the row joins their (already regional)
 * transaction. Otherwise the client is pinned to the org's data region so an
 * audit row for an ME/US org can never land in the global `DATABASE_URL`
 * database: regional GDPR erasure deletes `AuditLog` on the regional client, so
 * a mis-routed row is both a residency crossing and un-erasable.
 *
 * Region resolution order: explicit `region` → active tenant context → global
 * Organization directory (`dataRegion`, the same source `tenantMiddleware` and
 * the OAuth callback resolve region from). If none resolves we throw rather
 * than silently fall back to the global client.
 */
async function resolveAuditWriterClient(params: {
  tx?: AuditWriterClient;
  region?: string;
  organizationId: string;
}): Promise<AuditWriterClient> {
  if (params.tx) {
    return params.tx;
  }

  let region = params.region ?? tenantStore.getStore()?.region;
  if (!region) {
    const org = await prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { dataRegion: true },
    });
    region = org?.dataRegion ?? undefined;
  }

  if (!region) {
    throw new Error(
      `writeAuditLog: cannot resolve data region for organization ${params.organizationId} ` +
        '(no tx, no explicit region, no tenant context, org absent from directory); ' +
        'refusing to write the audit row to the global database.',
    );
  }

  return getRegionalClient(region) as unknown as AuditWriterClient;
}

/**
 * Pure row-shaper: validates required keys and applies the shared
 * before/after JSON discipline + actor-type defaults that every audit-log
 * write must obey. Both `writeAuditLog` and `writeAuditLogMany` route through
 * this so the persisted row shape is identical regardless of call style.
 */
function buildAuditLogRow(input: WriteAuditLogInput): Prisma.AuditLogUncheckedCreateInput {
  if (!input.organizationId) {
    throw new Error('writeAuditLog: organizationId is required');
  }
  if (!input.resourceId) {
    throw new Error('writeAuditLog: resourceId is required');
  }

  return {
    organizationId: input.organizationId,
    actorType: input.actorType as Prisma.AuditLogUncheckedCreateInput['actorType'],
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    action: input.action,
    resourceType: input.resourceType as Prisma.AuditLogUncheckedCreateInput['resourceType'],
    resourceId: input.resourceId,
    resourceName: input.resourceName ?? null,
    oldValuesJson: (input.oldValues ??
      undefined) as Prisma.AuditLogUncheckedCreateInput['oldValuesJson'],
    newValuesJson: (input.newValues ??
      undefined) as Prisma.AuditLogUncheckedCreateInput['newValuesJson'],
    metadataJson: (input.metadata ??
      undefined) as Prisma.AuditLogUncheckedCreateInput['metadataJson'],
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };
}

/**
 * Writes a single AuditLog row. Throws when organizationId or resourceId are
 * missing (invalid by construction); the thrown error surfaces to the calling
 * mutation so the outer transaction rolls back.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const data = buildAuditLogRow(input);
  const client = await resolveAuditWriterClient({
    tx: input.tx,
    region: input.region,
    organizationId: input.organizationId,
  });

  try {
    await client.auditLog.create({ data });
  } catch (err) {
    log.error(
      {
        err,
        organizationId: input.organizationId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
      },
      'writeAuditLog failed',
    );
    throw err;
  }
}

/**
 * Per-row payload accepted by `writeAuditLogMany`. Identical to
 * {@link WriteAuditLogInput} minus the transaction client — that is supplied
 * once at the batch level so every row commits in the same transaction.
 */
export type WriteAuditLogManyRow = Omit<WriteAuditLogInput, 'tx' | 'region'>;

export interface WriteAuditLogManyInput {
  /** Audit rows to insert. Each row is validated independently. */
  rows: readonly WriteAuditLogManyRow[];
  /**
   * Explicit data region for the batch. When omitted the region is resolved
   * from the active tenant context and, failing that, the global Organization
   * directory. Ignored when `tx` is supplied.
   */
  region?: string;
  /**
   * Optional Prisma transaction client — when supplied the batch insert joins
   * the caller's transaction. Otherwise the batch is pinned to the org's data
   * region (never the global client).
   */
  tx?: AuditWriterClient;
}

/**
 * Bulk variant of {@link writeAuditLog}. Forwards to `auditLog.createMany`
 * after applying the same validation + before/after JSON discipline to every
 * row, so callers writing N audit events in a single mutation get one
 * round-trip without losing the centralised shape.
 *
 * Empty `rows` is a no-op so callers can pass filtered arrays without an
 * outer guard.
 */
export async function writeAuditLogMany(input: WriteAuditLogManyInput): Promise<void> {
  if (input.rows.length === 0) {
    return;
  }

  const data = input.rows.map(buildAuditLogRow);
  const client = await resolveAuditWriterClient({
    tx: input.tx,
    region: input.region,
    organizationId: data[0]?.organizationId ?? '',
  });

  try {
    await client.auditLog.createMany({ data });
  } catch (err) {
    log.error(
      {
        err,
        rowCount: data.length,
        organizationId: data[0]?.organizationId,
        resourceType: data[0]?.resourceType,
      },
      'writeAuditLogMany failed',
    );
    throw err;
  }
}
