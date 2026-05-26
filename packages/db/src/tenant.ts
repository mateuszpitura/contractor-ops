import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from './generated/prisma/client/client.js';

// PHASE-60-CROSS-ORG-AGGREGATE: raw (non-tenant-scoped) client re-exported
// from tenant.ts so consumers can import the "tenant context family" from a
// single module. Use ONLY in cron cross-org aggregations — never in request
// handlers (see raw.ts for full rationale).
export { prismaRaw } from './raw.js';

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
 * Models where insert is allowed but subsequent mutation is forbidden.
 * Enforces append-only audit trail (Phase 59 D-06 — ClassificationDocument).
 * Delete is allowed (not a content mutation); update / updateMany / upsert are blocked.
 */
const APPEND_ONLY_MODELS = new Set(['ClassificationDocument']);

const APPEND_ONLY_BLOCKED_OPERATIONS = new Set(['update', 'updateMany', 'upsert']);

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
  // Phase 63 — Global reference data (no organizationId)
  'BoEBaseRateHistory',
  // Phase 60 CLASS-09 — cron-state singleton keyed by `name` only.
  // Auto-injecting organizationId here throws PrismaClientValidationError
  // because the model has no organizationId column.
  'CronScanState',
  // Global reference / per-user models with no organizationId column.
  'ExchangeRate',
  'UserPinnedView',
  // Child models with no organizationId column — tenancy enforced via the
  // parent relation filter at call site (e.g. SigningRecipient ↔
  // SigningEnvelope.organizationId, SigningEvent ↔ SigningEnvelope).
  'SigningRecipient',
  'SigningEvent',
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

        if (
          model &&
          APPEND_ONLY_MODELS.has(model) &&
          APPEND_ONLY_BLOCKED_OPERATIONS.has(operation)
        ) {
          throw new Error(
            `${model} is append-only; mutations after insert are forbidden (Phase 59 D-06).`,
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
