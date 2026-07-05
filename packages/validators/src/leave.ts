import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const leaveKindEnum = z.enum(['ANNUAL', 'PARENTAL', 'BEREAVEMENT', 'STUDY', 'SICK']);
export type LeaveKind = z.infer<typeof leaveKindEnum>;

export const leaveRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export type LeaveRequestStatus = z.infer<typeof leaveRequestStatusEnum>;

export const leaveLedgerTypeEnum = z.enum(['ACCRUAL', 'DEDUCTION', 'CARRYOVER', 'ADJUSTMENT']);
export type LeaveLedgerType = z.infer<typeof leaveLedgerTypeEnum>;

// A single leave request cannot exceed a full leap year of minutes. This is an
// overflow/abuse guard, not a policy limit — statutory entitlement is enforced
// downstream against the balance ledger.
const MAX_REQUEST_MINUTES = 366 * 24 * 60;

// ---------------------------------------------------------------------------
// Request + absence inputs
// ---------------------------------------------------------------------------

export const submitLeaveRequestInput = z
  .object({
    workerId: z.string().min(1),
    leaveTypeId: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date(),
    requestedMinutes: z.number().int().positive().max(MAX_REQUEST_MINUTES),
    teamId: z.string().min(1).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(v => v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });
export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestInput>;

export const recordSickAbsenceInput = z
  .object({
    workerId: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date(),
    minutes: z.number().int().positive().max(MAX_REQUEST_MINUTES),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(v => v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });
export type RecordSickAbsenceInput = z.infer<typeof recordSickAbsenceInput>;

// ---------------------------------------------------------------------------
// Org-config inputs (leave types + blackout periods)
// ---------------------------------------------------------------------------

export const leaveTypeUpsertInput = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(100),
    leaveKind: leaveKindEnum,
    paid: z.boolean().default(true),
    requiresApproval: z.boolean().default(true),
    colorHex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'colorHex must be a #rrggbb value')
      .optional(),
    active: z.boolean().default(true),
  })
  .strict();
export type LeaveTypeUpsertInput = z.infer<typeof leaveTypeUpsertInput>;

export const blackoutPeriodUpsertInput = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
    teamId: z.string().min(1).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(v => v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });
export type BlackoutPeriodUpsertInput = z.infer<typeof blackoutPeriodUpsertInput>;

// ---------------------------------------------------------------------------
// Ledger adjustment (correction) — reason is mandatory for the audit trail
// ---------------------------------------------------------------------------

export const leaveAdjustmentInput = z
  .object({
    workerId: z.string().min(1),
    leaveTypeId: z.string().min(1),
    // Signed: positive credits the balance, negative debits it. Corrections are
    // reversing entries, never edits to a prior ledger row (append-only).
    minutes: z
      .number()
      .int()
      .refine(v => v !== 0, 'minutes must be non-zero'),
    reason: z.string().trim().min(3).max(500),
    effectiveDate: z.string().date().optional(),
  })
  .strict();
export type LeaveAdjustmentInput = z.infer<typeof leaveAdjustmentInput>;
