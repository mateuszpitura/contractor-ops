// ---------------------------------------------------------------------------
// ZATCA Zod Validation Schemas
// ---------------------------------------------------------------------------

import { z } from 'zod';

/**
 * Saudi VAT number: 15 digits, starts and ends with "3".
 */
const saudiVatNumberRegex = /^3\d{13}3$/;

/**
 * Saudi postal code: exactly 5 digits.
 */
const saudiPostalCodeRegex = /^\d{5}$/;

/**
 * SHA-256 hex string (64 characters).
 */
const sha256HexRegex = /^[a-f0-9]{64}$/;

// ---------------------------------------------------------------------------
// Tax Details — collected during onboarding step 1
// ---------------------------------------------------------------------------

export const zatcaTaxDetailsSchema = z.object({
  vatNumber: z
    .string()
    .regex(
      saudiVatNumberRegex,
      'Must be a valid 15-digit Saudi VAT number starting and ending with 3',
    ),
  orgNameArabic: z.string().min(1, 'Arabic organization name is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
  postalCode: z.string().regex(saudiPostalCodeRegex, 'Must be a valid 5-digit Saudi postal code'),
  invoiceTypes: z
    .array(z.enum(['standard', 'simplified']))
    .min(1, 'At least one invoice type must be selected'),
});

export type ZatcaTaxDetails = z.infer<typeof zatcaTaxDetailsSchema>;

// ---------------------------------------------------------------------------
// CSR Attributes — used to generate the X.509 CSR for ZATCA
// ---------------------------------------------------------------------------

export const zatcaCsrAttributesSchema = z.object({
  commonName: z.string().min(1),
  orgName: z.string().min(1),
  vatNumber: z.string().regex(saudiVatNumberRegex),
  country: z.literal('SA'),
  serialNumber: z.string().min(1),
  title: z.enum(['0100', '1000', '1100']),
  registeredAddress: z.string().min(1),
  businessCategory: z.string().min(1),
});

export type ZatcaCsrAttributes = z.infer<typeof zatcaCsrAttributesSchema>;

// ---------------------------------------------------------------------------
// Invoice Fields — ZATCA-specific fields required for XML generation
// ---------------------------------------------------------------------------

export const zatcaInvoiceFieldsSchema = z.object({
  invoiceTypeCode: z.enum(['388', '381', '383']),
  invoiceSubtype: z.string().regex(/^[01]{7}$/, 'Must be a 7-character binary subtype'),
  icv: z.number().int().positive('ICV must be a positive integer'),
  pih: z.string().regex(sha256HexRegex, 'PIH must be a 64-character hex SHA-256 hash'),
  uuid: z.string().uuid('Must be a valid UUID v4'),
});

export type ZatcaInvoiceFields = z.infer<typeof zatcaInvoiceFieldsSchema>;

// ---------------------------------------------------------------------------
// Environment — sandbox or production
// ---------------------------------------------------------------------------

export const zatcaEnvironmentSchema = z.enum(['sandbox', 'production']);

export type ZatcaEnvironment = z.infer<typeof zatcaEnvironmentSchema>;

// ---------------------------------------------------------------------------
// Onboarding Step
// ---------------------------------------------------------------------------

export const zatcaOnboardingStepSchema = z.enum([
  'tax_details',
  'csr_generation',
  'compliance_csid',
  'compliance_checks',
  'production_certificate',
]);

export type ZatcaOnboardingStepType = z.infer<typeof zatcaOnboardingStepSchema>;

// ---------------------------------------------------------------------------
// Connection Config — stored in IntegrationConnection.configJson
// ---------------------------------------------------------------------------

export const zatcaConnectionConfigSchema = z.object({
  environment: zatcaEnvironmentSchema,
  currentStep: zatcaOnboardingStepSchema,
  taxDetails: zatcaTaxDetailsSchema.optional(),
  certificateStatus: z.enum(['none', 'compliance', 'production']).default('none'),
});

export type ZatcaConnectionConfig = z.infer<typeof zatcaConnectionConfigSchema>;
