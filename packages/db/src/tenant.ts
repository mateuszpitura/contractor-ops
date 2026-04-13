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

/** Operations that filter by `where.organizationId`. */
const READ_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that filter by `where.organizationId` (mutations). */
const MUTATION_WHERE_OPERATIONS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

function injectWhere(argsObj: Record<string, unknown>, organizationId: string): void {
  const where = (argsObj.where ?? {}) as Record<string, unknown>;
  argsObj.where = { ...where, organizationId };
}

function injectData(argsObj: Record<string, unknown>, organizationId: string): void {
  const data = (argsObj.data ?? {}) as Record<string, unknown>;
  argsObj.data = { ...data, organizationId };
}

function injectCreateManyData(argsObj: Record<string, unknown>, organizationId: string): void {
  const data = argsObj.data;
  if (Array.isArray(data)) {
    argsObj.data = data.map(item => ({
      ...(item as Record<string, unknown>),
      organizationId,
    }));
  } else {
    injectData(argsObj, organizationId);
  }
}

function injectUpsert(argsObj: Record<string, unknown>, organizationId: string): void {
  injectWhere(argsObj, organizationId);

  const create = (argsObj.create ?? {}) as Record<string, unknown>;
  argsObj.create = { ...create, organizationId };

  const update = (argsObj.update ?? {}) as Record<string, unknown>;
  argsObj.update = { ...update, organizationId };
}

function applyTenantScope(
  operation: string,
  argsObj: Record<string, unknown>,
  orgId: string,
): void {
  if (READ_OPERATIONS.has(operation) || MUTATION_WHERE_OPERATIONS.has(operation)) {
    injectWhere(argsObj, orgId);
  } else if (operation === 'create') {
    injectData(argsObj, orgId);
  } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
    injectCreateManyData(argsObj, orgId);
  } else if (operation === 'upsert') {
    injectUpsert(argsObj, orgId);
  }
}

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

        if (model && globalModels.has(model)) {
          return await query(args);
        }

        if (args == null || typeof args !== 'object') {
          return await query(args);
        }

        const argsObj = args as Record<string, unknown>;
        applyTenantScope(operation, argsObj, ctx.organizationId);
        return await query(argsObj);
      },
    },
  });
}
