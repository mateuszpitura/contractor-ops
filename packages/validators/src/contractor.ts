import { isValidIBAN } from 'ibantools';
import { z } from 'zod';
import { optionalFk, optionalPositiveInt, optionalString } from './helpers.js';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

const contractorTypeEnum = z.enum(['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER']);

const contractorStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

const contractorLifecycleStageEnum = z.enum([
  'DRAFT',
  'ONBOARDING',
  'ACTIVE',
  'OFFBOARDING',
  'ENDED',
]);

const complianceHealthEnum = z.enum(['green', 'yellow', 'red']);

// ---------------------------------------------------------------------------
// NIP validation (Polish tax identification number — mod-11 checksum)
// ---------------------------------------------------------------------------

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/**
 * Validates a Polish NIP number using the mod-11 checksum algorithm.
 * Strips spaces and hyphens before validation.
 */
export function isValidNip(raw: string): boolean {
  const nip = raw.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(nip)) return false;

  const digits = nip.split('').map(Number);
  const checksum = NIP_WEIGHTS.reduce((sum, w, i) => sum + w * (digits[i] ?? 0), 0) % 11;

  return checksum === digits[9];
}

/**
 * Zod schema for NIP — strips non-digit characters then validates mod-11.
 */
export const nipSchema = z
  .string()
  .transform(v => v.replace(/[\s-]/g, ''))
  .refine(isValidNip, { message: 'Invalid NIP number' });

const taxIdSchema = z.string().min(1, 'Tax ID is required').max(50);

// ---------------------------------------------------------------------------
// IBAN validation (via ibantools)
// ---------------------------------------------------------------------------

const ibanRefine = (val: string) => isValidIBAN(val.replace(/\s/g, '').toUpperCase());

// ---------------------------------------------------------------------------
// Contractor CRUD schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new contractor.
 * Covers company details, billing configuration, and team assignment.
 */
const contractorBaseSchema = z.object({
  // Company details
  legalName: z.string().min(1, 'Legal name is required').max(255),
  displayName: z.string().min(1, 'Display name is required').max(255),
  type: contractorTypeEnum,
  taxId: taxIdSchema,
  vatId: optionalString,
  registrationNumber: optionalString,
  email: z.string().email('Invalid email address'),
  phone: optionalString,
  countryCode: z.string().length(2).default('PL'),
  currency: z.string().length(3).default('PLN'),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  postalCode: optionalString,

  // Billing
  billingModel: z.string().min(1, 'Billing model is required'),
  rateValueMinor: z.number().int().positive('Rate must be a positive integer'),
  bankAccount: z
    .string()
    .transform(v => (v === '' ? undefined : v))
    .pipe(z.string().optional())
    .refine(val => !val || ibanRefine(val), {
      message: 'Invalid IBAN number',
    }),
  paymentTermsDays: optionalPositiveInt,

  // Assignment
  ownerUserId: z.string().min(1, 'Owner user ID is required'),
  primaryTeamId: optionalFk,
  primaryProjectId: optionalFk,
  defaultCostCenterId: optionalFk,
});

function validateCountryTaxId(
  data: { countryCode?: string; taxId?: string },
  ctx: z.RefinementCtx,
) {
  if (data.countryCode === 'PL' && data.taxId !== undefined && !isValidNip(data.taxId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taxId'],
      message: 'Invalid NIP number',
    });
  }
}

export const contractorCreateSchema = contractorBaseSchema.superRefine(validateCountryTaxId);

export type ContractorCreateInput = z.infer<typeof contractorCreateSchema>;

/**
 * Schema for partial updates (PATCH semantics — all fields optional).
 * Extends the create schema with additional fields that are editable
 * but not part of initial creation (e.g., notes).
 */
export const contractorUpdateSchema = contractorBaseSchema
  .partial()
  .extend({
    notes: z.string().optional(),
  })
  .superRefine(validateCountryTaxId);

export type ContractorUpdateInput = z.infer<typeof contractorUpdateSchema>;

/**
 * Schema for listing contractors with pagination, sorting, filtering, and FTS.
 */
export const contractorListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z
    .enum(['createdAt', 'legalName', 'status', 'lifecycleStage', 'type'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filters: z
    .object({
      status: z.array(contractorStatusEnum).optional(),
      lifecycleStage: z.array(contractorLifecycleStageEnum).optional(),
      ownerUserId: z.array(z.string()).optional(),
      primaryTeamId: z.array(z.string()).optional(),
      billingModel: z.array(z.string()).optional(),
      complianceHealth: z.array(complianceHealthEnum).optional(),
      contractEndDateFrom: z.iso.datetime().optional(),
      contractEndDateTo: z.iso.datetime().optional(),
    })
    .optional(),
});

export type ContractorListInput = z.infer<typeof contractorListSchema>;

/**
 * Schema for lifecycle stage transitions.
 */
export const contractorLifecycleTransitionSchema = z.object({
  id: z.string().min(1),
  stage: contractorLifecycleStageEnum,
});

export type ContractorLifecycleTransitionInput = z.infer<
  typeof contractorLifecycleTransitionSchema
>;

/**
 * Schema for GUS BIR1 API lookup by NIP.
 */
export const gusLookupSchema = z.object({
  nip: z.string().length(10, 'NIP must be exactly 10 digits'),
});

export type GusLookupInput = z.infer<typeof gusLookupSchema>;
