import { z } from 'zod';
import { mergeRouters, router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertWorkforceEnabled } from '../../middleware/require-workforce-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { employeeRegistryRouter } from '../employee/employee-registry-router.js';

// ---------------------------------------------------------------------------
// Skeleton employee surface (Theme B). Employee-specific profile data (personnel
// files, leave, on/offboarding) lands in a later phase on a dedicated
// EmployeeProfile model — this router only reads the identity-root Worker rows
// whose discriminator is EMPLOYEE. The explicit workerType pins the read to
// employees (and prevents the withWorkerTypeDefault CONTRACTOR default from
// applying). Conditionally spread behind `module.workforce-employees` (root.ts)
// with a per-request flag guard; inputs are Zod .strict() so organizationId /
// workerType cannot be injected by the client.
// ---------------------------------------------------------------------------

const employeeBaseRouter = router({
  /**
   * List employee-type workers in the caller's org. Read-only skeleton — the
   * employee profile surface is out of scope until the workforce phase.
   */
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z
        .object({
          take: z.number().int().min(1).max(200).default(100),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      assertWorkforceEnabled(ctx.organizationId, ctx.region);

      return ctx.db.worker.findMany({
        where: {
          organizationId: ctx.organizationId,
          workerType: 'EMPLOYEE',
          deletedAt: null,
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: input.take,
      });
    }),
});

// The skeleton read surface plus the registration / PII-reveal / reference-list
// procedures, exposed as a single `employee.*` namespace.
export const employeeRouter = mergeRouters(employeeBaseRouter, employeeRegistryRouter);
