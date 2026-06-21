// Per-market employee country-fields registry. A PARALLEL map to the contractor
// `countryFieldsSchemaMap` (same dispatch idiom), NOT a fork — the contractor
// registry stays untouched. These schemas validate the NON-PII, plain-but-
// RBAC-gated employee fields that are stored wholesale in the `countryFields`
// JSON column.
//
// Boundary invariant: national-person identifiers (PESEL, SSN, Iqama,
// Emirates ID) are NEVER accepted into this JSON. They live in dedicated
// encrypted columns only, validated + split at the router boundary. Every
// schema here is `.strict()`, so any pesel/ssn/iqama/emiratesId key is a parse
// error and can never round-trip into the wholesale `countryFields` read.

import { z } from 'zod';
import { isValidSvNummer } from './de-validators.js';
import {
  lohnsteuerklasseSchema,
  nfzOddzialSchema,
  studentLoanPlanSchema,
  usWithholdingStateSchema,
  w4FilingStatusSchema,
} from './employee-reference-lists.js';
import {
  isValidGosi,
  isValidNiNumber,
  isValidSteuerIdNr,
  isValidUkTaxCode,
  isValidWpsEstablishmentId,
} from './employee-validators.js';

// `etat` (PL/DE part-time fraction) and `fteFraction` are decimal strings in the
// range 0.10–1.00, kept as strings to avoid float drift in the JSON column.
const ETAT_REGEX = /^(?:0\.(?:[1-9]\d?|\d[1-9])|1\.00?|1)$/;

// ---------------------------------------------------------------------------
// PL — Poland
// ---------------------------------------------------------------------------
//
// Required: stanowisko (job title). Optional non-PII payroll references —
// urząd skarbowy (4-digit tax-office code), ZUS title code, NFZ branch, gross
// rate, part-time fraction. PESEL is encrypted elsewhere and excluded.

export const plEmployeeCountryFieldsSchema = z
  .object({
    stanowisko: z.string().trim().min(1),
    etat: z
      .string()
      .refine(v => ETAT_REGEX.test(v), 'etat must be a fraction between 0.10 and 1.00')
      .optional(),
    urzadSkarbowyCode: z
      .string()
      .refine(v => !v || /^\d{4}$/.test(v), 'Urząd skarbowy code must be 4 digits')
      .optional(),
    zusTitleCode: z
      .string()
      .refine(v => !v || /^\d{6}$/.test(v), 'ZUS title code must be 6 digits')
      .optional(),
    nfzOddzial: nfzOddzialSchema.optional(),
    stawkaBrutto: z
      .string()
      .refine(v => !v || /^\d+(?:\.\d{1,2})?$/.test(v), 'stawkaBrutto must be a decimal amount')
      .optional(),
  })
  .strict();

export type PlEmployeeCountryFields = z.infer<typeof plEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// DE — Germany
// ---------------------------------------------------------------------------
//
// Steuer-IdNr and SV-Nummer are plain-but-RBAC-gated (not encrypted), validated
// here via the audited checksum functions. Lohnsteuerklasse, Krankenkasse,
// Kinderfreibetrag, Kirchensteuer round out the payroll picture.

export const deEmployeeCountryFieldsSchema = z
  .object({
    lohnsteuerklasse: lohnsteuerklasseSchema.optional(),
    kirchensteuer: z.boolean().optional(),
    steuerIdNr: z
      .string()
      .refine(v => !v || isValidSteuerIdNr(v), 'Invalid Steuer-IdNr checksum')
      .optional(),
    svNummer: z
      .string()
      .refine(v => !v || isValidSvNummer(v), 'Invalid Sozialversicherungsnummer structural check')
      .optional(),
    krankenkasse: z
      .string()
      .refine(v => !v || /^\d{8}$/.test(v), 'Krankenkasse Betriebsnummer must be 8 digits')
      .optional(),
    kinderfreibetrag: z.number().min(0).max(20).optional(),
  })
  .strict();

export type DeEmployeeCountryFields = z.infer<typeof deEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// GB — United Kingdom
// ---------------------------------------------------------------------------
//
// NI number and tax code are plain-but-RBAC-gated; the student-loan plan and a
// pension-enrolment flag complete the PAYE set.

export const ukEmployeeCountryFieldsSchema = z
  .object({
    taxCode: z.string().refine(v => isValidUkTaxCode(v), 'Invalid UK tax code'),
    studentLoanPlan: studentLoanPlanSchema.optional(),
    niNumber: z
      .string()
      .refine(v => !v || isValidNiNumber(v), 'Invalid National Insurance number')
      .optional(),
    payeReference: z
      .string()
      .refine(v => !v || /^\d{3}\/[A-Z0-9]{1,10}$/.test(v), 'Invalid PAYE reference')
      .optional(),
    pensionEnrolled: z.boolean().optional(),
  })
  .strict();

export type UkEmployeeCountryFields = z.infer<typeof ukEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// US — United States
// ---------------------------------------------------------------------------
//
// W-4 step-1c filing status + state withholding. SSN is encrypted in a
// dedicated column (its own key) and is NEVER part of this JSON.

export const usEmployeeCountryFieldsSchema = z
  .object({
    filingStatus: w4FilingStatusSchema,
    stateWithholding: usWithholdingStateSchema,
    stateOther: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine(value => value.stateWithholding !== 'OTHER' || Boolean(value.stateOther), {
    message: 'stateOther is required when stateWithholding is OTHER',
    path: ['stateOther'],
  });

export type UsEmployeeCountryFields = z.infer<typeof usEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// AE — United Arab Emirates
// ---------------------------------------------------------------------------
//
// Visa type + WPS Establishment ID. The Emirates ID is encrypted elsewhere and
// excluded from this JSON.

export const aeVisaTypeEnum = z.enum(['EMPLOYMENT', 'GOLDEN', 'INVESTOR', 'FAMILY', 'FREELANCE']);

export const aeEmployeeCountryFieldsSchema = z
  .object({
    visaType: aeVisaTypeEnum,
    wpsEstablishmentId: z
      .string()
      .refine(v => !v || isValidWpsEstablishmentId(v), 'Invalid WPS Establishment ID')
      .optional(),
  })
  .strict();

export type AeEmployeeCountryFields = z.infer<typeof aeEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// SA — Saudi Arabia
// ---------------------------------------------------------------------------
//
// Coarse Nitaqat colour band (PLATINUM/GREEN/YELLOW/RED) + GOSI registration.
// The Iqama / national ID is encrypted elsewhere and excluded from this JSON.

export const saudizationBandEnum = z.enum(['PLATINUM', 'GREEN', 'YELLOW', 'RED']);

export const saEmployeeCountryFieldsSchema = z
  .object({
    saudizationCategory: saudizationBandEnum,
    gosiNumber: z
      .string()
      .refine(v => !v || isValidGosi(v), 'Invalid GOSI registration number')
      .optional(),
  })
  .strict();

export type SaEmployeeCountryFields = z.infer<typeof saEmployeeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// Dispatch — parallel to the contractor `countryFieldsSchemaMap`
// ---------------------------------------------------------------------------

export const employeeCountryFieldsSchemaMap: Record<string, z.ZodTypeAny> = {
  PL: plEmployeeCountryFieldsSchema,
  DE: deEmployeeCountryFieldsSchema,
  GB: ukEmployeeCountryFieldsSchema,
  US: usEmployeeCountryFieldsSchema,
  AE: aeEmployeeCountryFieldsSchema,
  SA: saEmployeeCountryFieldsSchema,
};

/**
 * Validate the non-PII employee country fields for a given country code.
 * Returns parsed fields or throws ZodError. Unknown country codes return `{}`
 * (no schema), mirroring the contractor dispatch.
 */
export function validateEmployeeCountryFields(
  countryCode: string,
  fields: unknown,
): Record<string, unknown> {
  const schema = employeeCountryFieldsSchemaMap[countryCode];
  if (!schema) return {};
  return schema.parse(fields) as Record<string, unknown>;
}
