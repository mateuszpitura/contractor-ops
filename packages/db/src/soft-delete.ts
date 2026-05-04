import type { Prisma } from './generated/prisma/client/client.js';

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
const softDeleteModels = new Set(['Organization', 'Contractor', 'Contract', 'Invoice', 'Document']);

/**
 * Inject `deletedAt: null` into the args.where for read & write operations
 * so soft-deleted rows are excluded. No-op when args is missing/non-object.
 *
 * F-DB-27: previously only applied to read operations (findMany, findFirst,
 * etc.) which meant `update`/`updateMany`/`upsert` could mutate soft-deleted
 * rows. We now also filter writes — any `update` against a soft-deleted row
 * becomes a no-op (P2025 / count: 0), preserving the audit invariant that
 * a "deleted" entity does not change state after deletion.
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
 *   rows are immutable (F-DB-27)
 */
export function withSoftDelete<T extends PrismaExtensible>(prisma: T) {
  return prisma.$extends({
    query: {
      $allModels: {
        async delete({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }

          // Convert delete to soft-delete
          const delegate = (prisma as unknown as Record<string, unknown>)[lowerFirst(model)] as
            | DelegateWithSoftDelete
            | undefined;

          if (!delegate) return await query(args);

          return await delegate.update({
            ...(args as Record<string, unknown>),
            data: { deletedAt: new Date() },
          });
        },

        async deleteMany({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }

          // Convert deleteMany to updateMany with deletedAt
          const delegate = (prisma as unknown as Record<string, unknown>)[lowerFirst(model)] as
            | DelegateWithSoftDelete
            | undefined;

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

        // F-DB-27: writes against soft-deleted rows must be no-ops
        // (otherwise audit trail can show a "deleted" entity changing state).
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
