import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../generated/prisma/client/index.js';

interface TenantContext {
  organizationId: string;
  region: string;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

export type PrismaExtensible = {
  $extends: Prisma.DefaultPrismaClient['$extends'];
};

type QueryHookParams = {
  operation: string;
  model?: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

/**
 * Global models that are NOT tenant-scoped.
 * These models do not have an organizationId field.
 */
const globalModels = new Set([
  'User',
  'Session',
  'Account',
  'Verification',
  'PortalSession',
  'PortalMagicToken',
  // Better Auth organization models — have their own organizationId
  // but must NOT be auto-scoped (queried cross-org in layout, auth flows)
  'Organization',
  'Member',
  'Invitation',
]);

/**
 * Wraps a PrismaClient with automatic tenant scoping.
 * All queries on tenant-scoped models will automatically include
 * the organizationId from the current AsyncLocalStorage context.
 *
 * Throws an error if a tenant-scoped query is executed without context.
 */
export function withTenantScope<T extends PrismaExtensible>(prisma: T) {
  return prisma.$extends({
    query: {
      async $allOperations({ operation, model, args, query }: QueryHookParams) {
        const ctx = tenantStore.getStore();

        if (!ctx) {
          throw new Error(
            'Tenant context not initialized. Wrap your code in tenantStore.run({ organizationId }, callback).',
          );
        }

        // Skip global models
        if (model && globalModels.has(model)) {
          return await query(args);
        }

        if (args == null || typeof args !== 'object') {
          return await query(args);
        }

        const argsObj = args as Record<string, unknown>;

        // Read operations — inject organizationId into where clause
        if (
          [
            'findMany',
            'findFirst',
            'findUnique',
            'findFirstOrThrow',
            'findUniqueOrThrow',
            'count',
            'aggregate',
            'groupBy',
          ].includes(operation)
        ) {
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, organizationId: ctx.organizationId };
        }

        // Create operations — inject organizationId into data
        if (operation === 'create') {
          const data = (argsObj.data ?? {}) as Record<string, unknown>;
          argsObj.data = { ...data, organizationId: ctx.organizationId };
        }

        if (operation === 'createMany' || operation === 'createManyAndReturn') {
          const data = argsObj.data;
          if (Array.isArray(data)) {
            argsObj.data = data.map(item => ({
              ...(item as Record<string, unknown>),
              organizationId: ctx.organizationId,
            }));
          } else {
            const dataObj = (data ?? {}) as Record<string, unknown>;
            argsObj.data = { ...dataObj, organizationId: ctx.organizationId };
          }
        }

        // Update/delete operations — inject organizationId into where clause
        if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, organizationId: ctx.organizationId };
        }

        // Upsert — inject organizationId into where, create, and update
        if (operation === 'upsert') {
          const where = (argsObj.where ?? {}) as Record<string, unknown>;
          argsObj.where = { ...where, organizationId: ctx.organizationId };

          const create = (argsObj.create ?? {}) as Record<string, unknown>;
          argsObj.create = { ...create, organizationId: ctx.organizationId };

          const update = (argsObj.update ?? {}) as Record<string, unknown>;
          argsObj.update = { ...update, organizationId: ctx.organizationId };
        }

        return await query(argsObj);
      },
    },
  });
}
