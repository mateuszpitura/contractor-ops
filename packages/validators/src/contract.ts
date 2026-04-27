import { z } from 'zod';
import { optionalFk, optionalPositiveInt, optionalString } from './helpers.js';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

const contractTypeEnum = z.enum([
  'B2B_MASTER_SERVICE',
  'STATEMENT_OF_WORK',
  'NDA',
  'IP_ASSIGNMENT',
  'DPA',
  'OTHER',
]);

const contractStatusEnum = z.enum([
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'TERMINATED',
  'SUPERSEDED',
  'ARCHIVED',
]);

const billingModelEnum = z.enum([
  'MONTHLY_RETAINER',
  'HOURLY',
  'DAILY',
  'MILESTONE',
  'DELIVERABLE_BASED',
  'MIXED',
]);

const rateTypeEnum = z.enum([
  'MONTHLY_FIXED',
  'PER_HOUR',
  'PER_DAY',
  'PER_MILESTONE',
  'PER_DELIVERABLE',
]);

const invoiceCycleEnum = z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DELIVERABLE', 'AD_HOC']);

const complianceRiskLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

// ---------------------------------------------------------------------------
// Contract CRUD schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new contract.
 * Covers contract metadata, billing, assignment, and dates.
 */
export const contractCreateSchema = z
  .object({
    contractorId: z.string().min(1, 'Contractor is required'),
    title: z.string().min(1, 'Contract title is required').max(255),
    type: contractTypeEnum,
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime().optional(),
    noticePeriodDays: z.number().int().positive().optional(),
    autoRenewal: z.boolean().default(false),
    renewalTerms: z.string().optional(),
    currency: z.string().length(3),
    billingModel: billingModelEnum,
    rateType: rateTypeEnum,
    rateValueMinor: z.number().int().nonnegative().optional(),
    retainerAmountMinor: z.number().int().nonnegative().optional(),
    expectedHoursPerPeriod: z.number().positive().optional(),
    paymentTermsDays: optionalPositiveInt,
    invoiceCycle: invoiceCycleEnum.optional(),
    internalOwnerUserId: optionalFk,
    teamId: optionalFk,
    projectId: optionalFk,
    costCenterId: optionalFk,
    notes: optionalString,
  })
  .refine(
    data => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    },
  );

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;

/**
 * Schema for partial updates (PATCH semantics — all fields optional).
 * contractorId is excluded as it cannot be changed after creation.
 */
const contractUpdateBaseSchema = z.object({
  title: z.string().min(1, 'Contract title is required').max(255),
  type: contractTypeEnum,
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime().nullish(),
  noticePeriodDays: z.number().int().positive().nullish(),
  autoRenewal: z.boolean(),
  renewalTerms: z.string().nullish(),
  currency: z.string().length(3),
  billingModel: billingModelEnum,
  rateType: rateTypeEnum,
  rateValueMinor: z.number().int().nonnegative().nullish(),
  retainerAmountMinor: z.number().int().nonnegative().nullish(),
  expectedHoursPerPeriod: z.number().positive().nullish(),
  paymentTermsDays: z.number().int().positive().nullish(),
  invoiceCycle: invoiceCycleEnum.nullish(),
  internalOwnerUserId: z.preprocess(v => (v === '' ? null : v), z.string().min(1).nullish()),
  teamId: z.preprocess(v => (v === '' ? null : v), z.string().min(1).nullish()),
  projectId: z.preprocess(v => (v === '' ? null : v), z.string().min(1).nullish()),
  costCenterId: z.preprocess(v => (v === '' ? null : v), z.string().min(1).nullish()),
  notes: z.string().nullish(),
});

export const contractUpdateSchema = contractUpdateBaseSchema.partial();

export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

/**
 * Schema for listing contracts with pagination, sorting, filtering, and FTS.
 */
export const contractListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z
    .enum(['createdAt', 'title', 'status', 'endDate', 'startDate', 'type'])
    .default('endDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  contractorId: z.string().optional(),
  filters: z
    .object({
      status: z.array(contractStatusEnum).optional(),
      type: z.array(contractTypeEnum).optional(),
      billingModel: z.array(billingModelEnum).optional(),
      ownerUserId: z.array(z.string()).optional(),
      endDateFrom: z.iso.datetime().optional(),
      endDateTo: z.iso.datetime().optional(),
      complianceRiskLevel: z.array(complianceRiskLevelEnum).optional(),
    })
    .optional(),
});

export type ContractListInput = z.infer<typeof contractListSchema>;

/**
 * Schema for contract status transitions.
 */
export const contractStatusTransitionSchema = z.object({
  id: z.string().min(1),
  targetStatus: contractStatusEnum,
});

export type ContractStatusTransitionInput = z.infer<typeof contractStatusTransitionSchema>;

/**
 * Schema for creating a contract amendment.
 */
export const amendmentCreateSchema = z.object({
  contractId: z.string().min(1),
  title: z.string().min(1, 'Amendment title is required').max(255),
  effectiveDate: z.iso.datetime(),
  description: z.string().optional(),
  changesSummaryJson: z.record(z.string(), z.unknown()),
});

export type AmendmentCreateInput = z.infer<typeof amendmentCreateSchema>;

/**
 * Schema for per-contract expiry reminder override.
 */
export const contractExpiryReminderSchema = z.object({
  contractId: z.string().min(1),
  reminderDaysBefore: z.array(z.number().int().positive()),
});

export type ContractExpiryReminderInput = z.infer<typeof contractExpiryReminderSchema>;

/**
 * Schema for org-level default expiry reminder intervals.
 * Used by the settings router for org-level defaults (e.g., [30, 60, 90]).
 */
export const orgExpiryReminderDefaultsSchema = z.object({
  reminderDaysBefore: z.array(z.number().int().positive()).min(1).max(10),
});

export type OrgExpiryReminderDefaultsInput = z.infer<typeof orgExpiryReminderDefaultsSchema>;
