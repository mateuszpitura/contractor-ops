import { z } from 'zod';
import { optionalFk, optionalPositiveInt, optionalString } from './helpers.js';

// ---------------------------------------------------------------------------
// Prisma enum mirrors — validators package stays Prisma-free.
// ---------------------------------------------------------------------------

/** Mirror of `SimpleStatus` in `packages/db/prisma/schema/organization.prisma`. */
export const orgDefinitionStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type OrgDefinitionStatus = z.infer<typeof orgDefinitionStatusEnum>;

/** Mirror of `OrgDefinitionSource` in `packages/db/prisma/schema/organization.prisma`. */
export const orgDefinitionSourceEnum = z.enum(['MANUAL', 'JIRA', 'LINEAR']);
export type OrgDefinitionSource = z.infer<typeof orgDefinitionSourceEnum>;

// ---------------------------------------------------------------------------
// Shared field-level schemas
// ---------------------------------------------------------------------------

const nameSchema = z.string().trim().min(1, 'name is required').max(120, 'name is too long');
const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/u, 'code may only contain letters, numbers, underscores and hyphens');
/** Same as `codeSchema` but transparently turns `""` / `undefined` into `undefined` so
 *  forms can submit a blank field without tripping the regex. */
const optionalCodeSchema = z.preprocess(
  v => (v === '' || v === undefined ? undefined : v),
  codeSchema.optional(),
);
const uppercaseCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Z0-9_-]+$/u, 'code must be uppercase letters, digits, underscores or hyphens');

/** ISO 4217 currency code — 3 uppercase letters. */
const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/u, 'currency must be a 3-letter ISO 4217 code');

/**
 * `optionalDate` accepts an ISO-8601 date string (`YYYY-MM-DD`) or a `Date`,
 * normalising both to a `Date` so callers can hand it straight to Prisma.
 */
const optionalDate = z
  .union([z.string().trim().min(1), z.date()])
  .optional()
  .transform(v => (v === undefined || v === '' ? undefined : new Date(v)))
  .refine(
    v => v === undefined || !Number.isNaN(v.getTime()),
    'date must be a valid ISO-8601 value',
  );

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const teamCreateSchema = z.object({
  name: nameSchema,
  code: optionalCodeSchema,
  managerUserId: optionalFk,
  fallbackApproverId: optionalFk,
  status: orgDefinitionStatusEnum.optional().default('ACTIVE'),
});
export type TeamCreateInput = z.infer<typeof teamCreateSchema>;

export const teamUpdateSchema = teamCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;

export const teamListSchema = z.object({
  status: orgDefinitionStatusEnum.optional(),
  source: orgDefinitionSourceEnum.optional(),
  search: optionalString,
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});
export type TeamListInput = z.infer<typeof teamListSchema>;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const projectCreateSchema = z
  .object({
    name: nameSchema,
    code: optionalCodeSchema,
    teamId: optionalFk,
    status: orgDefinitionStatusEnum.optional().default('ACTIVE'),
    startDate: optionalDate,
    endDate: optionalDate,
    budgetMinor: optionalPositiveInt,
    budgetCurrency: currencyCodeSchema.optional(),
  })
  .refine(v => !(v.startDate && v.endDate) || v.endDate >= v.startDate, {
    message: 'endDate cannot be before startDate',
    path: ['endDate'],
  })
  .refine(v => (v.budgetMinor === undefined) === (v.budgetCurrency === undefined), {
    message: 'budgetMinor and budgetCurrency must be set together',
    path: ['budgetCurrency'],
  });
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    id: z.string().min(1),
    name: nameSchema.optional(),
    code: optionalCodeSchema,
    teamId: optionalFk,
    status: orgDefinitionStatusEnum.optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    budgetMinor: optionalPositiveInt,
    budgetCurrency: currencyCodeSchema.optional(),
  })
  .refine(v => !(v.startDate && v.endDate) || v.endDate >= v.startDate, {
    message: 'endDate cannot be before startDate',
    path: ['endDate'],
  });
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectListSchema = z.object({
  status: orgDefinitionStatusEnum.optional(),
  source: orgDefinitionSourceEnum.optional(),
  teamId: optionalFk,
  search: optionalString,
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});
export type ProjectListInput = z.infer<typeof projectListSchema>;

export const projectSyncSchema = z.object({
  connectionId: z.string().min(1),
});
export type ProjectSyncInput = z.infer<typeof projectSyncSchema>;

export const projectMergeResolveSchema = z
  .object({
    pendingMergeId: z.string().min(1),
    action: z.enum(['merge', 'keep']),
    mergeIntoProjectId: optionalFk,
  })
  .refine(v => v.action !== 'merge' || Boolean(v.mergeIntoProjectId), {
    message: 'mergeIntoProjectId is required when action is "merge"',
    path: ['mergeIntoProjectId'],
  });
export type ProjectMergeResolveInput = z.infer<typeof projectMergeResolveSchema>;

// ---------------------------------------------------------------------------
// Cost Center
// ---------------------------------------------------------------------------

export const costCenterCreateSchema = z.object({
  name: nameSchema,
  // Codes are case-sensitive unique in the DB (`@@unique([organizationId, code])`)
  // and surfaced uppercase on the page; enforce that here so a mixed-case import
  // can be caught before the SQL round-trip.
  code: uppercaseCodeSchema,
  status: orgDefinitionStatusEnum.optional().default('ACTIVE'),
});
export type CostCenterCreateInput = z.infer<typeof costCenterCreateSchema>;

export const costCenterUpdateSchema = costCenterCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;

export const costCenterListSchema = z.object({
  status: orgDefinitionStatusEnum.optional(),
  search: optionalString,
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});
export type CostCenterListInput = z.infer<typeof costCenterListSchema>;

/** Single CSV row as parsed from the upload preview. */
export const costCenterCsvRowSchema = z.object({
  name: nameSchema,
  code: uppercaseCodeSchema,
});
export type CostCenterCsvRow = z.infer<typeof costCenterCsvRowSchema>;

/** CSV import payload: enforces row-count cap (mirrors the 1000-row UI guard). */
export const costCenterCsvImportSchema = z.object({
  rows: z
    .array(costCenterCsvRowSchema)
    .min(1, 'at least one row is required')
    .max(1000, 'CSV import is capped at 1000 rows'),
});
export type CostCenterCsvImportInput = z.infer<typeof costCenterCsvImportSchema>;

// ---------------------------------------------------------------------------
// Archive — shared across all three resources
// ---------------------------------------------------------------------------

export const orgDefinitionArchiveSchema = z.object({
  id: z.string().min(1),
});
export type OrgDefinitionArchiveInput = z.infer<typeof orgDefinitionArchiveSchema>;
