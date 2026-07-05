import { z } from 'zod';

// Employee self-service portal inputs.
//
// The defining security property of every input here is what it OMITS: none
// carries a `workerId`. The portal handler derives the subject from the session
// (ctx.workerId), so a client can never name another worker. Every schema is
// `.strict()` so a smuggled `workerId` (or any unexpected key) is a hard
// validation rejection, not a silently-ignored field.

// A single leave request cannot exceed a full leap year of minutes — an
// overflow/abuse guard, not a policy limit (statutory entitlement is enforced
// downstream against the balance ledger). Mirrors the staff leave validator.
const MAX_REQUEST_MINUTES = 366 * 24 * 60;

/**
 * Time-off request from the portal. The staff `submitLeaveRequestInput` shape
 * MINUS `workerId` and `teamId` (the subject and its team are server-derived).
 */
export const portalTimeOffRequestInput = z
  .object({
    leaveTypeId: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date(),
    requestedMinutes: z.number().int().positive().max(MAX_REQUEST_MINUTES),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(v => v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });
export type PortalTimeOffRequestInput = z.infer<typeof portalTimeOffRequestInput>;

/** Self-scoped leave-balance query — the worker is the session subject. */
export const portalLeaveBalanceQueryInput = z
  .object({
    leaveTypeId: z.string().min(1),
    year: z.number().int().min(2000).max(2100).optional(),
  })
  .strict();
export type PortalLeaveBalanceQueryInput = z.infer<typeof portalLeaveBalanceQueryInput>;
