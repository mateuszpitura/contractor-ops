import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';

// ---------------------------------------------------------------------------
// Shared cross-type worker surface (Theme B). The Worker row is the normalized
// identity root that Contractor (and a future Employee) link to. Cross-type
// reads pass an EXPLICIT workerType filter so the withWorkerTypeDefault
// extension leaves the where untouched (explicit-where-wins) — a worker.list
// can therefore return both contractors and employees, unlike a default
// Contractor read which the extension scopes to workerType='CONTRACTOR'.
//
// The router is conditionally spread into appRouter behind
// `module.workforce-employees` (root.ts); each procedure also re-evaluates the
// flag per request for defense-in-depth. Inputs are Zod .strict() so a client
// cannot inject organizationId / workerType — both are set server-side from the
// session and from the requested filter.
// ---------------------------------------------------------------------------

const WORKER_TYPES = ['CONTRACTOR', 'EMPLOYEE'] as const;

export const workerRouter = router({
  /**
   * Cross-type worker list — returns identity-root rows across worker types in
   * the caller's org. An explicit workerType filter (when supplied) is passed
   * straight through; when omitted, both types are queried so the extension's
   * CONTRACTOR default never narrows a deliberate cross-type read.
   */
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z
        .object({
          types: z.array(z.enum(WORKER_TYPES)).min(1).optional(),
          take: z.number().int().min(1).max(200).default(100),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      const requestedTypes = input.types ?? WORKER_TYPES;

      return ctx.db.worker.findMany({
        where: {
          organizationId: ctx.organizationId,
          // Explicit cross-type filter — withWorkerTypeDefault sees a present
          // workerType key and leaves the where alone (no CONTRACTOR default).
          workerType: { in: [...requestedTypes] },
          deletedAt: null,
        },
        select: {
          id: true,
          workerType: true,
          displayName: true,
          email: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: input.take,
      });
    }),

  /**
   * Cross-type worker read by id. Scoped to the caller's org; the explicit
   * type set keeps the extension from force-filtering to CONTRACTOR.
   */
  getById: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ id: z.string().min(1) }).strict())
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      return ctx.db.worker.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          workerType: { in: [...WORKER_TYPES] },
          deletedAt: null,
        },
        select: {
          id: true,
          workerType: true,
          displayName: true,
          email: true,
          status: true,
          createdAt: true,
        },
      });
    }),
});
