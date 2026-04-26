// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — shared AuditLog writer.
// ---------------------------------------------------------------------------
//
// Before this plan, ContractorAssignment + Contract mutations did NOT emit
// AuditLog rows (Open Question #1, resolved here). This helper is the single
// write path used by contractor/contract/reassessment routers so the daily
// reassessment scan has an auditable event stream to walk.
//
// Security contract:
//   - The caller MUST supply organizationId (no implicit tenant lookup).
//   - When invoked inside a router mutation, callers pass `tx` so the audit
//     row commits/rolls back atomically with the business mutation.
//   - NO console.* — uses @contractor-ops/logger per CLAUDE.md.
//   - Accepts ONLY `create`. Updates and deletes on AuditLog are forbidden
//     (audit is append-only per audit.prisma contract).

import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'audit-writer' });

/** Mirrors @contractor-ops/db ActorType Prisma enum. */
export type AuditActorType = 'USER' | 'SYSTEM' | 'INTEGRATION' | 'API_KEY' | 'CONTRACTOR';

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
  | 'RETURN_REQUEST';

/**
 * Thin shape accepted for `tx` — any Prisma client (base or transactional)
 * that exposes `auditLog.create` suffices. We keep it structural so both the
 * tenant-extended client and raw `$transaction` tx accept cleanly.
 */
export interface AuditWriterClient {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
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
  /** Optional Prisma transaction client — when supplied the insert joins the caller's transaction. */
  tx?: AuditWriterClient;
}

/**
 * Writes a single AuditLog row. Throws when organizationId or resourceId are
 * missing (invalid by construction); the thrown error surfaces to the calling
 * mutation so the outer transaction rolls back.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  if (!input.organizationId) {
    throw new Error('writeAuditLog: organizationId is required');
  }
  if (!input.resourceId) {
    throw new Error('writeAuditLog: resourceId is required');
  }

  const client: AuditWriterClient = input.tx ?? (prisma as unknown as AuditWriterClient);

  try {
    await client.auditLog.create({
      data: {
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
      },
    });
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
