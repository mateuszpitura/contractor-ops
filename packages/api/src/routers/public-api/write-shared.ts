import type { AuditEntityType, AuditWriterClient } from '../../services/audit-writer';
import { writeAuditLog } from '../../services/audit-writer';

/**
 * The subset of the API-key tRPC ctx every public write reads for its audit row.
 */
export interface PublicWriteCtx {
  organizationId: string;
  apiKeyId?: string;
  apiKeyActingUserId?: string;
  sourceIp?: string;
  userAgent?: string;
}

/**
 * Single audit path for every external (API-key) mutation. Records the
 * non-repudiation fields the write surface must carry: `actorType:'API_KEY'`
 * + `actorId` (the key id) + captured `ipAddress`/`userAgent`, plus
 * `metadata.actingUserId` (the attribution actor — never an authorization
 * source). Pass `tx` so the audit row commits atomically with the mutation.
 */
export function writePublicApiAudit(args: {
  ctx: PublicWriteCtx;
  action: string;
  resourceType: AuditEntityType;
  resourceId: string;
  resourceName?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  tx?: AuditWriterClient;
}): Promise<void> {
  return writeAuditLog({
    tx: args.tx,
    organizationId: args.ctx.organizationId,
    actorType: 'API_KEY',
    actorId: args.ctx.apiKeyId ?? null,
    action: args.action,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    resourceName: args.resourceName ?? null,
    oldValues: args.oldValues ?? null,
    newValues: args.newValues ?? null,
    ipAddress: args.ctx.sourceIp ?? null,
    userAgent: args.ctx.userAgent ?? null,
    metadata: { actingUserId: args.ctx.apiKeyActingUserId ?? null },
  });
}
