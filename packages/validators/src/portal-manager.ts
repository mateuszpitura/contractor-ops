import { z } from 'zod';

// Employee-portal MANAGER inputs.
//
// The report set is derived server-side from the reporting-line edge
// (`managerWorkerId = ctx.workerId`); the manager never sends a list of report
// ids. A leave action names the target request AND the report it belongs to —
// the handler re-derives the request's own workerId and asserts it is a direct
// report, so `reportWorkerId` is a cross-check, never a trust anchor. Every
// schema is `.strict()` so an unexpected key (e.g. a smuggled `workerId`) is a
// hard rejection.

/** Read scopes take no input — the report set is server-derived. A stray key
 *  (e.g. a client `workerId`) is a hard `.strict()` rejection. */
export const portalManagerNoInput = z.object({}).strict().optional();

/** Approve a direct report's pending leave request. */
export const portalManagerApproveLeaveInput = z
  .object({
    requestId: z.string().min(1),
    reportWorkerId: z.string().min(1),
  })
  .strict();
export type PortalManagerApproveLeaveInput = z.infer<typeof portalManagerApproveLeaveInput>;

/** Reject a direct report's pending leave request, with an optional reason
 *  captured on the audit trail. */
export const portalManagerRejectLeaveInput = z
  .object({
    requestId: z.string().min(1),
    reportWorkerId: z.string().min(1),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();
export type PortalManagerRejectLeaveInput = z.infer<typeof portalManagerRejectLeaveInput>;
