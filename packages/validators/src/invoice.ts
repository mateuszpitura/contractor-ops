import { z } from 'zod';
import { optionalFk } from './helpers.js';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const invoiceStatusEnum = z.enum([
  'RECEIVED',
  'UNDER_REVIEW',
  'APPROVAL_PENDING',
  'APPROVED',
  'REJECTED',
  'READY_FOR_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
]);

export const invoiceMatchStatusEnum = z.enum([
  'UNMATCHED',
  'PARTIAL',
  'MATCHED',
  'DISCREPANCY',
  'MANUALLY_CONFIRMED',
]);

export const invoiceSourceEnum = z.enum(['MANUAL_UPLOAD', 'EMAIL_INTAKE', 'KSEF', 'API']);

export const invoiceFileRoleEnum = z.enum([
  'SOURCE_ORIGINAL',
  'PARSED_COPY',
  'SUPPORTING_ATTACHMENT',
  'CORRECTION',
]);

// ---------------------------------------------------------------------------
// Invoice CRUD schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new invoice.
 * Covers invoice metadata, financial fields, seller info, and linked documents.
 */
// §13b UStG service-type enum exported for schema reuse.
// Values mirror `DE13bServiceType` in packages/api/src/services/reverse-charge.service.ts
// (cannot import from @contractor-ops/api: API depends on validators, not vice versa).
export const de13bServiceTypeEnum = z.enum([
  'CONSTRUCTION',
  'CLEANING_BUILDING',
  'SCRAP_METALS',
  'GOLD',
  'MOBILE_PHONES',
]);

export type De13bServiceType = z.infer<typeof de13bServiceTypeEnum>;

const invoiceCreateBaseSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(100),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  servicePeriodStart: z.string().date().optional(),
  servicePeriodEnd: z.string().date().optional(),
  currency: z.string().length(3).default('PLN'),
  subtotalMinor: z.number().int().min(0),
  // Dynamic VAT rate code — validated against TaxRate table at creation time
  vatRate: z.string().max(10).optional(),
  vatAmountMinor: z.number().int().min(0).optional(),
  totalMinor: z.number().int().min(0),
  withholdingMinor: z.number().int().min(0).optional(),
  isReverseCharge: z.boolean().optional().default(false),
  reverseChargeOverride: z.boolean().optional(),
  // Required free-text justification when the user disables an auto-detected
  // reverse-charge flag.
  reverseChargeOverrideReason: z.string().min(5).max(500).optional(),
  // §13b UStG service classification used by the reverse-charge auto-detector
  // for DE→DE domestic rule.
  serviceType: de13bServiceTypeEnum.optional(),
  amountToPayMinor: z.number().int().min(0),
  sellerTaxId: z.string().max(50).optional(),
  sellerName: z.string().max(500).optional(),
  sellerBankAccount: z.string().max(34).optional(),
  // contractorId used to resolve the seller jurisdiction + VAT ID for
  // reverse-charge auto-detection and staleness revalidation.
  // Optional: manual-upload flows without a contractor match still succeed.
  contractorId: z.string().optional(),
  documentIds: z.array(z.string()).min(1, 'At least one document is required'),
});

export const invoiceCreateSchema = invoiceCreateBaseSchema
  .refine(
    d => {
      const issue = new Date(d.issueDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return issue <= today;
    },
    { message: 'Issue date cannot be in the future', path: ['issueDate'] },
  )
  .refine(d => new Date(d.dueDate) >= new Date(d.issueDate), {
    message: 'Due date must be on or after issue date',
    path: ['dueDate'],
  })
  .refine(
    d => {
      if (!(d.servicePeriodStart && d.servicePeriodEnd)) return true;
      return new Date(d.servicePeriodEnd) >= new Date(d.servicePeriodStart);
    },
    {
      message: 'Service period end must be on or after start',
      path: ['servicePeriodEnd'],
    },
  )
  .refine(
    d => d.totalMinor === d.subtotalMinor + (d.vatAmountMinor ?? 0) - (d.withholdingMinor ?? 0),
    {
      message: 'INVOICE_AMOUNT_MISMATCH',
      path: ['totalMinor'],
    },
  )
  .refine(d => d.amountToPayMinor === d.totalMinor, {
    message: 'INVOICE_AMOUNT_MISMATCH',
    path: ['amountToPayMinor'],
  })
  // Disabling auto-detected reverse charge requires a reason.
  // Only enforced when `reverseChargeOverride === false` (i.e. user explicitly
  // turned RC off). `undefined` means no override at all — pipeline auto-detects.
  .refine(
    d => {
      if (d.reverseChargeOverride !== false) return true;
      return (
        typeof d.reverseChargeOverrideReason === 'string' &&
        d.reverseChargeOverrideReason.length >= 5
      );
    },
    {
      message: 'Override reason required when disabling auto-detected reverse charge',
      path: ['reverseChargeOverrideReason'],
    },
  );

export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;

/**
 * Schema for partial updates (PATCH semantics — all fields optional).
 */
export const invoiceUpdateSchema = invoiceCreateBaseSchema.partial();

export type InvoiceUpdate = z.infer<typeof invoiceUpdateSchema>;

/**
 * Schema for listing invoices with pagination, sorting, and filtering.
 */
export const invoiceListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  search: z.string().optional(),
  sortBy: z
    .enum(['receivedAt', 'invoiceNumber', 'issueDate', 'dueDate', 'totalMinor', 'status'])
    .default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filters: z
    .object({
      status: z.array(invoiceStatusEnum).optional(),
      matchStatus: z.array(invoiceMatchStatusEnum).optional(),
      source: z.array(invoiceSourceEnum).optional(),
      contractorId: z.string().optional(),
      // `dueDate < now AND status NOT IN ('PAID', 'VOID')`. Matches the
      // overdue cell badge used by columns.tsx so the chip and table cell
      // surface the same set of invoices.
      overdue: z.boolean().optional(),
    })
    .optional(),
});

export type InvoiceList = z.infer<typeof invoiceListSchema>;

/**
 * Schema for manually matching an invoice to a contractor and optionally a contract.
 */
export const invoiceManualMatchSchema = z.object({
  invoiceId: z.string().min(1),
  contractorId: z.string().min(1),
  contractId: optionalFk,
});

export type InvoiceManualMatch = z.infer<typeof invoiceManualMatchSchema>;
