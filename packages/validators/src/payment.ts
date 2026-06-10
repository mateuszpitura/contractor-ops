import { isValidBIC, isValidIBAN } from 'ibantools';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions -- validators package has no Prisma dep)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Organization bank info (org settingsJson.bankAccount) — validated before it
// feeds the SEPA / Elixir / SWIFT export serializers. An IBAN/BIC that fails
// modulus/format checks would silently produce an unusable or misrouted bank
// file, so the export path treats malformed org bank data as absent rather
// than passing the raw string through.
// ---------------------------------------------------------------------------

export const orgBankInfoSchema = z.object({
  iban: z
    .string()
    .refine(val => isValidIBAN(val.replace(/\s/g, '').toUpperCase()), {
      message: 'Invalid organization IBAN',
    })
    .optional(),
  bic: z
    .string()
    .refine(val => isValidBIC(val.replace(/\s/g, '').toUpperCase()), {
      message: 'Invalid organization BIC',
    })
    .optional(),
});

export type OrgBankInfoInput = z.infer<typeof orgBankInfoSchema>;

export const paymentRunStatusEnum = z.enum([
  'DRAFT',
  'LOCKED',
  'EXPORTED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const paymentRunItemStatusEnum = z.enum([
  'PENDING',
  'EXPORTED',
  'PAID',
  'FAILED',
  'SKIPPED',
]);

export const paymentExportFormatEnum = z.enum(['CSV', 'BANK_FILE', 'SEPA_XML', 'SWIFT_XML']);

// ---------------------------------------------------------------------------
// Payment Run schemas
// ---------------------------------------------------------------------------

/**
 * Create a new payment run from selected invoices.
 * groupByCurrency: when true, auto-creates separate runs per currency.
 */
export const paymentRunCreateSchema = z.object({
  invoiceIds: z.array(z.cuid()).min(1),
  currency: z.string().length(3).optional(),
  name: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  groupByCurrency: z.boolean().default(false),
  /** Client-generated idempotency key to prevent duplicate payment runs. */
  idempotencyKey: z.string().max(64).optional(),
});

export type PaymentRunCreate = z.infer<typeof paymentRunCreateSchema>;

/**
 * Lock a payment run and generate export file.
 */
export const paymentRunLockSchema = z.object({
  runId: z.cuid(),
  exportFormat: paymentExportFormatEnum,
});

export type PaymentRunLock = z.infer<typeof paymentRunLockSchema>;

/**
 * Update a single payment run item status (paid/failed).
 * Failure reason is required when marking as failed.
 */
export const paymentRunItemStatusSchema = z
  .object({
    itemId: z.cuid(),
    status: z.enum(['PAID', 'FAILED']),
    paymentReference: z.string().max(100).optional(),
    failureReason: z.string().max(500).optional(),
  })
  .refine(d => d.status !== 'FAILED' || (d.failureReason && d.failureReason.length > 0), {
    message: 'Failure reason required when marking failed',
    path: ['failureReason'],
  });

export type PaymentRunItemStatus = z.infer<typeof paymentRunItemStatusSchema>;

/**
 * List payment runs with pagination, sorting, and filtering.
 */
export const paymentRunListSchema = z.object({
  status: paymentRunStatusEnum.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'runNumber', 'totalMinor']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type PaymentRunList = z.infer<typeof paymentRunListSchema>;

/**
 * Cancel a payment run.
 */
export const paymentRunCancelSchema = z.object({
  runId: z.cuid(),
});

export type PaymentRunCancel = z.infer<typeof paymentRunCancelSchema>;

/**
 * Mark all items in a run as paid (happy path bulk action).
 */
export const markAllPaidSchema = z.object({
  runId: z.cuid(),
  batchReference: z.string().max(100).optional(),
});

export type MarkAllPaid = z.infer<typeof markAllPaidSchema>;

/**
 * Confirm matched bank statement transactions against run items.
 */
export const bankStatementConfirmSchema = z.object({
  runId: z.cuid(),
  matches: z.array(
    z.object({
      itemId: z.cuid(),
      transactionIndex: z.number().int(),
    }),
  ),
});

export type BankStatementConfirm = z.infer<typeof bankStatementConfirmSchema>;

/**
 * List invoices ready for payment with optional filters.
 */
export const readyForPaymentListSchema = z.object({
  currency: z.string().length(3).optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  contractorId: z.cuid().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ReadyForPaymentList = z.infer<typeof readyForPaymentListSchema>;

/**
 * Remove an invoice from a DRAFT payment run.
 */
export const removeFromRunSchema = z.object({
  runId: z.cuid(),
  invoiceId: z.cuid(),
});

export type RemoveFromRun = z.infer<typeof removeFromRunSchema>;
