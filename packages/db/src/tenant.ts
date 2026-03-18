import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../generated/prisma/client/index.js";

interface TenantContext {
  organizationId: string;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

/**
 * Global models that are NOT tenant-scoped.
 * These models do not have an organizationId field.
 */
const globalModels = new Set([
  "User",
  "Session",
  "Account",
  "Verification",
]);

/**
 * Wraps a PrismaClient with automatic tenant scoping.
 * All queries on tenant-scoped models will automatically include
 * the organizationId from the current AsyncLocalStorage context.
 *
 * Throws an error if a tenant-scoped query is executed without context.
 */
export function withTenantScope<T extends PrismaClient>(prisma: T) {
  return prisma.$extends({
    query: {
      $allOperations({ operation, model, args, query }) {
        const ctx = tenantStore.getStore();

        if (!ctx) {
          throw new Error(
            "Tenant context not initialized. Wrap your code in tenantStore.run({ organizationId }, callback)."
          );
        }

        // Skip global models
        if (model && globalModels.has(model)) {
          return query(args);
        }

        // Read operations — inject organizationId into where clause
        if (
          [
            "findMany",
            "findFirst",
            "findUnique",
            "findFirstOrThrow",
            "findUniqueOrThrow",
            "count",
            "aggregate",
            "groupBy",
          ].includes(operation)
        ) {
          args.where = { ...args.where, organizationId: ctx.organizationId };
        }

        // Create operations — inject organizationId into data
        if (operation === "create") {
          args.data = { ...args.data, organizationId: ctx.organizationId };
        }

        if (operation === "createMany") {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: Record<string, unknown>) => ({
              ...item,
              organizationId: ctx.organizationId,
            }));
          } else {
            args.data = { ...args.data, organizationId: ctx.organizationId };
          }
        }

        // Update/delete operations — inject organizationId into where clause
        if (
          ["update", "updateMany", "delete", "deleteMany", "upsert"].includes(
            operation
          )
        ) {
          args.where = { ...args.where, organizationId: ctx.organizationId };
        }

        return query(args);
      },
    },
  });
}
