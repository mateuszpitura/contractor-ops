import { Prisma } from './generated/prisma/client/client.js';
import type { RetainedRecordType } from './retention-policy.js';
import { getRetentionCutoff } from './retention-policy.js';

type PrismaExtensible = {
  $extends: Prisma.DefaultPrismaClient['$extends'];
};

type ModelQueryHookParams = {
  model: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

type DelegateWithSoftDelete = {
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

/**
 * Models that support soft delete (have a deletedAt field).
 * When deleting these models, the operation is converted to
 * an update that sets deletedAt to the current timestamp.
 * Read operations automatically filter out soft-deleted records.
 */
const softDeleteModels = new Set([
  'Organization',
  'Contractor',
  'Contract',
  'Invoice',
  'Document',
  'Form1099Nec',
]);

/**
 * Inject `deletedAt: null` into the args.where for read & write operations
 * so soft-deleted rows are excluded. No-op when args is missing/non-object.
 *
 * Previously only applied to read operations (findMany, findFirst, etc.) which
 * meant `update`/`updateMany`/`upsert` could mutate soft-deleted rows. We now
 * also filter writes — any `update` against a soft-deleted row becomes a no-op
 * (P2025 / count: 0), preserving the audit invariant that a "deleted" entity
 * does not change state after deletion.
 */
function injectDeletedAtNull(args: unknown): unknown {
  if (args == null || typeof args !== 'object') {
    return args;
  }
  const argsObj = args as Record<string, unknown>;
  const where = (argsObj.where ?? {}) as Record<string, unknown>;
  argsObj.where = { ...where, deletedAt: null };
  return argsObj;
}

/**
 * Wraps a PrismaClient with soft-delete behavior.
 * - delete/deleteMany are converted to update deletedAt
 * - findMany/findFirst/findFirstOrThrow/count automatically filter where deletedAt is null
 * - update/updateMany/upsert also filter where deletedAt is null so soft-deleted
 *   rows are immutable
 */
export function withSoftDelete<T extends PrismaExtensible>(
  prisma: T,
  retentionOverride?: Partial<Record<string, RetainedRecordType>>,
) {
  // A model under an active statutory-retention rule must never be hard-deleted
  // at this chokepoint. `getRetentionCutoff` returning a non-null cutoff means
  // the model is retention-guarded, so the delete is forced through the
  // soft-delete conversion below even if the model is absent from
  // `softDeleteModels`. The production retention map ships empty, so this is a
  // no-op for all current models; tests inject a fixture override.
  const isRetentionGuarded = (model: string): boolean =>
    getRetentionCutoff(model, new Date(), retentionOverride) !== null;
  const requiresSoftDelete = (model: string): boolean =>
    softDeleteModels.has(model) || isRetentionGuarded(model);

  return prisma.$extends({
    query: {
      $allModels: {
        async delete(this: unknown, { model, args, query }: ModelQueryHookParams) {
          if (!requiresSoftDelete(model)) {
            return await query(args);
          }

          // Convert delete to soft-delete.
          // Use Prisma.getExtensionContext to route through the fully-extended
          // client (tenant scope + soft-delete), not the base prisma instance.
          const ctx = Prisma.getExtensionContext(this) as unknown as Record<string, unknown>;
          const delegate = ctx[lowerFirst(model)] as DelegateWithSoftDelete | undefined;

          if (!delegate) return await query(args);

          return await delegate.update({
            ...(args as Record<string, unknown>),
            data: { deletedAt: new Date() },
          });
        },

        async deleteMany(this: unknown, { model, args, query }: ModelQueryHookParams) {
          if (!requiresSoftDelete(model)) {
            return await query(args);
          }

          // Convert deleteMany to updateMany with deletedAt.
          // Route through the extended client to preserve tenant scoping.
          const ctx = Prisma.getExtensionContext(this) as unknown as Record<string, unknown>;
          const delegate = ctx[lowerFirst(model)] as DelegateWithSoftDelete | undefined;

          if (!delegate) return await query(args);

          return await delegate.updateMany({
            ...(args as Record<string, unknown>),
            data: { deletedAt: new Date() },
          });
        },

        async findMany({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async findUnique({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async findUniqueOrThrow({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async findFirst({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async findFirstOrThrow({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async count({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        // Writes against soft-deleted rows must be no-ops (otherwise the audit
        // trail can show a "deleted" entity changing state).
        async update({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async updateMany({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },

        async upsert({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }
          return await query(injectDeletedAtNull(args));
        },
      },
    },
  });
}

/**
 * Convert PascalCase model name to camelCase for Prisma client access.
 */
function lowerFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
