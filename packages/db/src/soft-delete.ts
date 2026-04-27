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
 * Wraps a PrismaClient with soft-delete behavior.
 * - delete/deleteMany are converted to update deletedAt
 * - findMany/findFirst/count automatically filter where deletedAt is null
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

          if (args == null || typeof args !== 'object') {
            return await query(args);
          }

          const argsObj = args as Record<string, unknown>;
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, deletedAt: null };
          return await query(argsObj);
        },

        async findFirst({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }

          if (args == null || typeof args !== 'object') {
            return await query(args);
          }

          const argsObj = args as Record<string, unknown>;
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, deletedAt: null };
          return await query(argsObj);
        },

        async findFirstOrThrow({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }

          if (args == null || typeof args !== 'object') {
            return await query(args);
          }

          const argsObj = args as Record<string, unknown>;
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, deletedAt: null };
          return await query(argsObj);
        },

        async count({ model, args, query }: ModelQueryHookParams) {
          if (!softDeleteModels.has(model)) {
            return await query(args);
          }

          if (args == null || typeof args !== 'object') {
            return await query(args);
          }

          const argsObj = args as Record<string, unknown>;
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, deletedAt: null };
          return await query(argsObj);
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
