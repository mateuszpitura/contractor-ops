import type { AuditEntityType, AuditWriterClient } from '../services/audit-writer.js';
import { writeAuditLog } from '../services/audit-writer.js';
import type { TenantDbTx, TenantScopedDb } from './tenant-db.js';

/** Client passed to mutation callbacks inside `$transaction`. */
export type AuditedMutationTx = TenantDbTx;

export type AuditMutationMeta = {
  action: string;
  resourceType: AuditEntityType;
  resourceId: string;
  resourceName?: string | null;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

export type AuditMutationCtx = {
  organizationId: string;
  userId?: string | null;
  /** When set, mutation + audit run in a single DB transaction. */
  db?: TenantScopedDb;
};

type TransactionCapableClient = TenantScopedDb & {
  $transaction: <T>(fn: (tx: AuditedMutationTx) => Promise<T>) => Promise<T>;
};

function isTransactionCapable(client: TenantScopedDb): client is TransactionCapableClient {
  return (
    '$transaction' in client &&
    typeof (client as TransactionCapableClient).$transaction === 'function'
  );
}

export function auditMutationCtx(ctx: {
  organizationId: string;
  user?: { id: string } | null;
  db: TenantScopedDb;
}): AuditMutationCtx {
  return {
    organizationId: ctx.organizationId,
    userId: ctx.user?.id ?? null,
    db: ctx.db,
  };
}

/**
 * Run a mutation and emit a matching audit log entry in the same transaction when
 * `ctx.db` or `explicitTx` is provided. Pass `explicitTx` when already inside
 * `ctx.db.$transaction`; pass `ctx.db` via {@link auditMutationCtx} otherwise.
 */
export async function auditedMutation<T>(
  ctx: AuditMutationCtx,
  meta: AuditMutationMeta,
  run: (tx: AuditedMutationTx) => Promise<T>,
  explicitTx?: AuditedMutationTx,
): Promise<T> {
  const writeAudit = async (tx: AuditedMutationTx, result: T): Promise<T> => {
    await writeAuditLog({
      organizationId: ctx.organizationId,
      actorType: 'USER',
      actorId: ctx.userId ? ctx.userId : null,
      action: meta.action,
      resourceType: meta.resourceType,
      resourceId: meta.resourceId,
      resourceName: meta.resourceName,
      metadata: meta.metadata,
      oldValues: meta.oldValues,
      newValues: meta.newValues,
      tx: tx as unknown as AuditWriterClient,
    });
    return result;
  };

  if (explicitTx) {
    const result = await run(explicitTx);
    return writeAudit(explicitTx, result);
  }

  if (ctx.db && isTransactionCapable(ctx.db)) {
    return ctx.db.$transaction(async tx => {
      const mutationTx = tx as AuditedMutationTx;
      const result = await run(mutationTx);
      return writeAudit(mutationTx, result);
    });
  }

  if (ctx.db) {
    const result = await run(ctx.db);
    return writeAudit(ctx.db, result);
  }

  const result = await run(undefined as unknown as AuditedMutationTx);
  await writeAuditLog({
    organizationId: ctx.organizationId,
    actorType: 'USER',
    actorId: ctx.userId ? ctx.userId : null,
    action: meta.action,
    resourceType: meta.resourceType,
    resourceId: meta.resourceId,
    resourceName: meta.resourceName,
    metadata: meta.metadata,
    oldValues: meta.oldValues,
    newValues: meta.newValues,
  });
  return result;
}
