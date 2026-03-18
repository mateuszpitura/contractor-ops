import type { PrismaClient } from "../generated/prisma/client/index";

/**
 * Models that support soft delete (have a deletedAt field).
 * When deleting these models, the operation is converted to
 * an update that sets deletedAt to the current timestamp.
 * Read operations automatically filter out soft-deleted records.
 */
const softDeleteModels = new Set([
  "Organization",
  "Contractor",
  "Contract",
  "Invoice",
  "Document",
]);

/**
 * Wraps a PrismaClient with soft-delete behavior.
 * - delete/deleteMany are converted to update deletedAt
 * - findMany/findFirst/count automatically filter where deletedAt is null
 */
export function withSoftDelete<T extends PrismaClient>(prisma: T) {
  return prisma.$extends({
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          // Convert delete to soft-delete
          return (prisma as any)[lowerFirst(model)].update({
            ...args,
            data: { deletedAt: new Date() },
          });
        },

        async deleteMany({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          // Convert deleteMany to updateMany with deletedAt
          return (prisma as any)[lowerFirst(model)].updateMany({
            ...args,
            data: { deletedAt: new Date() },
          });
        },

        async findMany({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },

        async findFirstOrThrow({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },

        async count({ model, args, query }) {
          if (!softDeleteModels.has(model)) {
            return query(args);
          }

          args.where = { ...args.where, deletedAt: null };
          return query(args);
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
