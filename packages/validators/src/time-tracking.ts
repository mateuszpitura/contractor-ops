import { z } from "zod";

// ---------------------------------------------------------------------------
// Single draft entry for save
// ---------------------------------------------------------------------------

export const draftEntrySchema = z.object({
  id: z.string().optional(), // existing entry ID for update
  contractId: z.string().min(1),
  entryDate: z.string().date(), // YYYY-MM-DD
  minutes: z.number().int().min(0).max(1440), // 0-24h in minutes
  description: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Save multiple draft entries at once (weekly grid save)
// ---------------------------------------------------------------------------

export const saveDraftEntriesSchema = z.object({
  timesheetId: z.string().min(1),
  entries: z.array(draftEntrySchema).min(1).max(50),
});

// ---------------------------------------------------------------------------
// Single ad-hoc entry form
// ---------------------------------------------------------------------------

export const createSingleEntrySchema = z.object({
  contractId: z.string().min(1),
  entryDate: z.string().date(),
  minutes: z.number().int().min(15).max(1440), // min 15min (0.25h)
  description: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/** Submit timesheet for review */
export const submitTimesheetSchema = z.object({
  timesheetId: z.string().min(1),
});

/** Approve timesheet (manager) */
export const approveTimesheetSchema = z.object({
  timesheetId: z.string().min(1),
});

/** Reject timesheet (manager, D-07 requires reason) */
export const rejectTimesheetSchema = z.object({
  timesheetId: z.string().min(1),
  reason: z.string().min(10).max(500),
});

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

export const bulkApproveTimesheetsSchema = z.object({
  timesheetIds: z.array(z.string().min(1)).min(1).max(50),
});

export const bulkRejectTimesheetsSchema = z.object({
  timesheetIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().min(10).max(500),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get timesheet by week */
export const getTimesheetSchema = z.object({
  weekStartDate: z.string().date(), // Must be a Monday (validated in service)
});

/** List timesheets with filters (admin) */
export const listTimesheetsSchema = z.object({
  status: z
    .enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"])
    .optional(),
  contractorId: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// External sync (D-09, D-10)
// ---------------------------------------------------------------------------

export const syncExternalEntriesSchema = z.object({
  provider: z.enum(["CLOCKIFY", "JIRA"]),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

// ---------------------------------------------------------------------------
// Time reconciliation
// ---------------------------------------------------------------------------

export const timeReconciliationSchema = z.object({
  contractId: z.string().min(1),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  invoicedAmountGrosze: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type DraftEntry = z.infer<typeof draftEntrySchema>;
export type SaveDraftEntries = z.infer<typeof saveDraftEntriesSchema>;
export type CreateSingleEntry = z.infer<typeof createSingleEntrySchema>;
export type SubmitTimesheet = z.infer<typeof submitTimesheetSchema>;
export type ApproveTimesheet = z.infer<typeof approveTimesheetSchema>;
export type RejectTimesheet = z.infer<typeof rejectTimesheetSchema>;
export type BulkApproveTimesheets = z.infer<
  typeof bulkApproveTimesheetsSchema
>;
export type BulkRejectTimesheets = z.infer<typeof bulkRejectTimesheetsSchema>;
export type GetTimesheet = z.infer<typeof getTimesheetSchema>;
export type ListTimesheets = z.infer<typeof listTimesheetsSchema>;
export type SyncExternalEntries = z.infer<typeof syncExternalEntriesSchema>;
export type TimeReconciliation = z.infer<typeof timeReconciliationSchema>;
