import { z } from 'zod';
import { usEntityTypeEnum } from './country-fields.js';
import { isValidEin } from './us-validators.js';

// ---------------------------------------------------------------------------
// W-Form intake validators (W-9 / W-8BEN / W-8BEN-E).
//
// A discriminated union keyed on `formType`. Shared by the portal wizard's
// React Hook Form resolver and the server-side tRPC input — one schema, one
// source of truth for the captured-field shape.
//
// PII boundary: the W-9 variant NEVER carries a full SSN. The SSN lives in the
// contractor's dedicated encrypted column (with its own reveal gate); only the
// last-4 reference is captured here. A full EIN is acceptable in-form (it is not
// a personal identifier and is validated via isValidEin). Putting a full SSN in
// this payload would bypass the contractorPii:read gate and the log PII mask.
//
// Server-derived fields (signedAt, IP, userId/contractorId) are NOT part of
// this client schema — they are captured server-side into the immutable
// snapshot so a client cannot forge the attestation identity/timestamp.
//
// LOCAL-ONLY: FTIN format varies by jurisdiction with no US-style checksum, so
// it is validated loosely (presence + length bound). The treaty rate/article
// are auto-populated by treaty-rate.service; the optional fields here let the
// confirmed claim travel with the submission.
// ---------------------------------------------------------------------------

/** Shared ESIGN-Act attestation block. signedAt / IP are server-derived. */
const attestationFields = {
  /** "Under penalties of perjury" certification — must be explicitly accepted. */
  perjuryAccepted: z.literal(true),
  /** Typed full legal name of the signer. */
  signerName: z.string().trim().min(1, 'Signer name is required'),
} as const;

/** Foreign permanent-residence address for W-8 forms (IRS line 3). */
const foreignAddressFields = {
  addressLine1: z.string().trim().min(1, 'Address line 1 is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
} as const;

/**
 * Foreign Taxpayer Identification Number. Loose validation only — there is no
 * universal FTIN algorithm, so we bound length and reject empty input rather
 * than apply a US-style checksum.
 */
const ftinSchema = z.string().trim().min(1, 'FTIN is required').max(30, 'FTIN is too long');

/** Last-4 reference to the encrypted SSN, or a full EIN — never a full SSN. */
const tinReferenceSchema = z
  .object({
    /** Last 4 digits of the SSN, referencing the encrypted column. */
    ssnLast4: z
      .string()
      .regex(/^\d{4}$/, 'SSN last-4 must be exactly 4 digits')
      .optional(),
    /** Full EIN (not a personal identifier) — validated via the IRS prefix table. */
    ein: z
      .string()
      .trim()
      .refine(v => isValidEin(v), 'Invalid EIN')
      .optional(),
  })
  .refine(v => Boolean(v.ssnLast4) || Boolean(v.ein), {
    message: 'Provide an EIN or the last 4 digits of the SSN on file',
  });

/** Optional auto-populated treaty claim carried with W-8 submissions. */
const treatyClaimFields = {
  treatyArticle: z.string().trim().optional(),
  treatyRate: z.number().min(0).max(100).optional(),
} as const;

/** W-9 — US persons. */
export const w9FormSchema = z.object({
  formType: z.literal('W9'),
  usEntityType: usEntityTypeEnum,
  backupWithholding: z.boolean(),
  tin: tinReferenceSchema,
  ...attestationFields,
});

/** W-8BEN — foreign individuals. */
export const w8benFormSchema = z.object({
  formType: z.literal('W8BEN'),
  treatyCountry: z.string().length(2, 'Treaty country must be a 2-letter code'),
  ftin: ftinSchema,
  ...foreignAddressFields,
  ...treatyClaimFields,
  ...attestationFields,
});

/** W-8BEN-E entity LOB categories (IRS line 14b). Adviser-deferred copy. */
export const lobCategoryEnum = z.enum([
  'GOVERNMENT',
  'TAX_EXEMPT_PENSION_TRUST',
  'OTHER_TAX_EXEMPT_ORGANIZATION',
  'PUBLICLY_TRADED_CORPORATION',
  'SUBSIDIARY_OF_PUBLICLY_TRADED_CORPORATION',
  'COMPANY_MEETS_OWNERSHIP_BASE_EROSION_TEST',
  'COMPANY_MEETS_DERIVATIVE_BENEFITS_TEST',
  'COMPANY_WITH_ITEM_OF_INCOME_MEETS_ACTIVE_TRADE_BUSINESS_TEST',
  'FAVORABLE_DISCRETIONARY_DETERMINATION',
  'OTHER',
]);

/** Chapter-3 entity classification (IRS line 4). Adviser-deferred copy. */
export const w8beneEntityTypeEnum = z.enum([
  'CORPORATION',
  'PARTNERSHIP',
  'DISREGARDED_ENTITY',
  'TRUST',
  'ESTATE',
  'GOVERNMENT',
  'CENTRAL_BANK_OF_ISSUE',
  'TAX_EXEMPT_ORGANIZATION',
  'PRIVATE_FOUNDATION',
  'INTERNATIONAL_ORGANIZATION',
]);

/** W-8BEN-E — foreign entities. */
export const w8beneFormSchema = z.object({
  formType: z.literal('W8BENE'),
  treatyCountry: z.string().length(2, 'Treaty country must be a 2-letter code'),
  entityType: w8beneEntityTypeEnum,
  lobCategory: lobCategoryEnum,
  ftin: ftinSchema,
  ...foreignAddressFields,
  ...treatyClaimFields,
  ...attestationFields,
});

/**
 * Per-form discriminated union keyed on `formType`. Validate any W-form intake
 * submission against this — the discriminant selects the W-9 / W-8BEN /
 * W-8BEN-E variant and applies that form's required fields.
 */
export const taxFormSubmissionSchema = z.discriminatedUnion('formType', [
  w9FormSchema,
  w8benFormSchema,
  w8beneFormSchema,
]);

export type W9FormInput = z.infer<typeof w9FormSchema>;
export type W8BenFormInput = z.infer<typeof w8benFormSchema>;
export type W8BeneFormInput = z.infer<typeof w8beneFormSchema>;
export type TaxFormSubmissionInput = z.infer<typeof taxFormSubmissionSchema>;
export type LobCategory = z.infer<typeof lobCategoryEnum>;
