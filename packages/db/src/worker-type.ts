import type { PrismaExtensible } from './tenant.js';

/**
 * Models that get the `workerType` default injected. Only the Worker identity
 * root carries the discriminator — a Contractor row is inherently a contractor,
 * so Contractor reads are left untouched.
 */
const WORKER_TYPE_DEFAULTED_MODELS = new Set(['Worker']);

/**
 * Read operations whose `where` clause gets the default discriminator. Matches
 * the tenant-scope extension's read-operation set so the two extensions cover
 * the same surface.
 */
const WORKER_TYPE_READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Inject `workerType: 'CONTRACTOR'` into `args.where`, but only when the caller
 * has not already specified `workerType`. The opt-out is deliberate: cross-type
 * callers (a shared worker surface, or an employee surface) pass their own
 * `workerType` and must not be force-filtered back to contractors. No-op when
 * args is missing/non-object; a fresh `where` is created when none is supplied.
 */
function injectWorkerTypeDefault(args: unknown): unknown {
  if (args == null || typeof args !== 'object') {
    return args;
  }
  const argsObj = args as Record<string, unknown>;
  const where = (argsObj.where ?? {}) as Record<string, unknown>;
  if ('workerType' in where) {
    return argsObj;
  }
  argsObj.where = { ...where, workerType: 'CONTRACTOR' };
  return argsObj;
}

/**
 * Wraps a Prisma client so reads on the Worker base model default to
 * `workerType = 'CONTRACTOR'` unless the caller passes an explicit
 * `workerType` (explicit-where-wins). Chained outermost in `createTenantClient`
 * — after tenant scope and soft-delete — so the discriminator default rides on
 * top of the org-scope and soft-delete predicates.
 *
 * Raw SQL (`$queryRaw`/`$executeRaw`) is NOT intercepted by Prisma query
 * extensions (the callback receives `model: undefined`); raw contractor reads
 * spell out their own predicate and are guarded by a dedicated CI check.
 */
export function withWorkerTypeDefault<T extends PrismaExtensible>(prisma: T) {
  return prisma.$extends({
    query: {
      $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }) {
        if (!(model && WORKER_TYPE_DEFAULTED_MODELS.has(model))) {
          return query(args);
        }
        if (!WORKER_TYPE_READ_OPS.has(operation)) {
          return query(args);
        }
        return query(injectWorkerTypeDefault(args));
      },
    },
  });
}
