import { z } from 'zod';
import { isValidHandelsregister, isValidSvNummer, isValidUstIdNr } from './de-validators.js';
import { HANDELSREGISTER_COURTS } from './handelsregister-courts.js';
import { getSteuernummerFormat, getSteuernummerRegex } from './steuernummer-formats.js';
import { isValidCompaniesHouseNumber, isValidGbVat, isValidUtr } from './uk-validators.js';
import { isValidEin } from './us-validators.js';

// ---------------------------------------------------------------------------
// UAE Country Fields
// ---------------------------------------------------------------------------

export const uaeCountryFieldsSchema = z.object({
  freelancePermitNumber: z.string().optional(),
  tradeLicenseNumber: z.string().optional(),
  freeZone: z.boolean().optional(),
  tradeLicenseExpiry: z.string().date().optional(),
});

export type UaeCountryFields = z.infer<typeof uaeCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// Saudi Country Fields
// ---------------------------------------------------------------------------

export const saudiCountryFieldsSchema = z.object({
  freelanceSaLicense: z.string().optional(),
  commercialRegistration: z.string().optional(),
  commercialRegistrationExpiry: z.string().date().optional(),
});

export type SaudiCountryFields = z.infer<typeof saudiCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// UK Country Fields (Phase 56 — FOUND-01)
// ---------------------------------------------------------------------------
//
// D-04 conditional required-field rules (UI-SPEC §Interaction 1 matrix):
//   - SOLE_TRADER → UTR required
//   - LTD         → Companies House number required
//   - LLP         → Companies House number required
//   - isVatRegistered=true → vatRegistrationNumber required
// Field-level `.refine` catches checksum errors before the conditional `superRefine`
// runs, so invalid-format submissions surface the precise checksum issue first.

export const ukEntityTypeEnum = z.enum(['SOLE_TRADER', 'LTD', 'LLP']);

export const ukCountryFieldsSchema = z
  .object({
    entityType: ukEntityTypeEnum,
    isVatRegistered: z.boolean().default(false),
    utr: z
      .string()
      .refine(v => !v || isValidUtr(v), 'Invalid UTR checksum')
      .optional(),
    companiesHouseNumber: z
      .string()
      .refine(v => !v || isValidCompaniesHouseNumber(v), 'Invalid Companies House number')
      .optional(),
    vatRegistrationNumber: z
      .string()
      .refine(v => !v || isValidGbVat(v), 'Invalid UK VAT registration number')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entityType === 'SOLE_TRADER' && !data.utr) {
      ctx.addIssue({
        code: 'custom',
        message: 'UTR is required for sole traders',
        path: ['utr'],
      });
    }
    if (data.entityType === 'LTD' && !data.companiesHouseNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'Companies House number is required for limited companies',
        path: ['companiesHouseNumber'],
      });
    }
    if (data.entityType === 'LLP' && !data.companiesHouseNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'Companies House number is required for limited companies',
        path: ['companiesHouseNumber'],
      });
    }
    if (data.isVatRegistered && !data.vatRegistrationNumber) {
      ctx.addIssue({
        code: 'custom',
        message: 'VAT registration number is required when VAT-registered is toggled on',
        path: ['vatRegistrationNumber'],
      });
    }
  });

export type UkCountryFields = z.infer<typeof ukCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// DE Country Fields (Phase 56 — FOUND-02)
// ---------------------------------------------------------------------------
//
// D-04 conditional required-field rules (UI-SPEC §Interaction 1 matrix):
//   - Steuernummer always required; dispatched per Bundesland regex
//   - Handelsregister required for UG / GMBH only (OHG/KG optional — do NOT require)
//   - USt-IdNr required when isVatRegistered=true AND not Kleinunternehmer
//
// Error messages follow UI-SPEC §Copywriting Error states. Translations live in
// messages/de.json under ContractorProfile.CountryCompliance.DE (Plan 05).
// Mandatory legal phrases (Steuernummer label etc.) resolve from legal/de.ts via
// Plan 05 — schema-level messages are user-friendly English strings only.

export const deEntityTypeEnum = z.enum([
  'EINZELUNTERNEHMEN',
  'GBR',
  'OHG',
  'KG',
  'UG',
  'GMBH',
  'AG',
]);

const deBundeslandEnum = z.enum([
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
]);

const handelsregisterSchema = z
  .object({
    court: z.string(),
    type: z.enum(['HRB', 'HRA']),
    number: z.string().regex(/^\d{1,7}$/, 'Number must be 1–7 digits'),
  })
  .refine(v => HANDELSREGISTER_COURTS.some(c => c.code === v.court), {
    message: 'Unknown Handelsregister court',
    path: ['court'],
  });

export const deCountryFieldsSchema = z
  .object({
    bundesland: deBundeslandEnum,
    entityType: deEntityTypeEnum,
    isVatRegistered: z.boolean().default(false),
    isKleinunternehmer: z.boolean().default(false),
    steuernummer: z.string().optional(),
    ustIdNr: z
      .string()
      .refine(v => !v || isValidUstIdNr(v), 'Invalid USt-IdNr checksum')
      .optional(),
    handelsregister: handelsregisterSchema.optional(),
    sozialversicherungsnummer: z
      .string()
      .refine(v => !v || isValidSvNummer(v), 'Invalid Sozialversicherungsnummer structural check')
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Steuernummer — required + Bundesland-specific regex dispatch
    if (data.steuernummer) {
      const format = getSteuernummerFormat(data.bundesland);
      const rx = getSteuernummerRegex(data.bundesland);
      if (!rx.test(data.steuernummer)) {
        ctx.addIssue({
          code: 'custom',
          message: `Steuernummer format does not match ${format.germanName}. Example: ${format.example}.`,
          path: ['steuernummer'],
        });
      }
    } else {
      ctx.addIssue({
        code: 'custom',
        message: 'Steuernummer is required',
        path: ['steuernummer'],
      });
    }

    // Handelsregister — required for UG/GMBH only
    if ((data.entityType === 'UG' || data.entityType === 'GMBH') && !data.handelsregister) {
      ctx.addIssue({
        code: 'custom',
        message: 'Handelsregister is required for UG/GmbH entities',
        path: ['handelsregister'],
      });
    }

    // Handelsregister composite — structural validity check (composite-level).
    // Delegates to Plan 03's isValidHandelsregister for cross-field structural
    // consistency. Per-field format + court-whitelist are handled by the inner
    // `handelsregisterSchema` .refine, so this catches any residual mismatch.
    if (data.handelsregister && !isValidHandelsregister(data.handelsregister)) {
      ctx.addIssue({
        code: 'custom',
        message: 'All three parts are required: court, register type (HRB/HRA), and number.',
        path: ['handelsregister'],
      });
    }

    // USt-IdNr — required when VAT-registered and not Kleinunternehmer
    if (data.isVatRegistered && !data.isKleinunternehmer && !data.ustIdNr) {
      ctx.addIssue({
        code: 'custom',
        message: 'USt-IdNr is required when VAT-registered and not a Kleinunternehmer',
        path: ['ustIdNr'],
      });
    }
  });

export type DeCountryFields = z.infer<typeof deCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// US Country Fields (Phase 84 — US-FIELD-01)
// ---------------------------------------------------------------------------
//
// D-05 conditional required-field rules (84-RESEARCH Open Question 3; mirrors
// the uk SOLE_TRADER→UTR conditional):
//   - LLC / C_CORP / S_CORP / PARTNERSHIP → EIN required
//   - INDIVIDUAL / SOLE_PROPRIETOR        → EIN optional (may file on the SSN)
//
// SSN is DELIBERATELY EXCLUDED from this JSONB schema (T-84-01-01). It lives in
// dedicated encrypted columns (Plan 03) with its own input validator + reveal
// gate; putting it here would leak it unmasked through getCountryFields. The
// `state` field is constrained to a 2-letter code; EIN format is checked field-
// level via isValidEin before the conditional superRefine runs.
//
// LOCAL-ONLY: the IRS/SSA rules behind isValidEin need legal/tax-adviser
// verification before production deploy (annotated in us-validators.ts).

export const usEntityTypeEnum = z.enum([
  'SOLE_PROPRIETOR',
  'LLC',
  'C_CORP',
  'S_CORP',
  'PARTNERSHIP',
  'INDIVIDUAL',
]);

const US_ENTITY_TYPES_REQUIRING_EIN = ['LLC', 'C_CORP', 'S_CORP', 'PARTNERSHIP'] as const;

export const usCountryFieldsSchema = z
  .object({
    entityType: usEntityTypeEnum,
    ein: z
      .string()
      .refine(v => !v || isValidEin(v), 'Invalid EIN')
      .optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().length(2).optional(),
    zipCode: z.string().optional(),
    uspsVerified: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (US_ENTITY_TYPES_REQUIRING_EIN as readonly string[]).includes(data.entityType) &&
      !data.ein
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'EIN is required for LLCs, corporations, and partnerships',
        path: ['ein'],
      });
    }
  });

export type UsCountryFields = z.infer<typeof usCountryFieldsSchema>;

// ---------------------------------------------------------------------------
// Country Fields Union
// ---------------------------------------------------------------------------

export const countryFieldsSchemaMap: Record<string, z.ZodTypeAny> = {
  AE: uaeCountryFieldsSchema,
  SA: saudiCountryFieldsSchema,
  GB: ukCountryFieldsSchema,
  DE: deCountryFieldsSchema,
  US: usCountryFieldsSchema,
};

/**
 * Validate country fields for a given country code.
 * Returns parsed fields or throws ZodError.
 */
export function validateCountryFields(
  countryCode: string,
  fields: unknown,
): Record<string, unknown> {
  const schema = countryFieldsSchemaMap[countryCode];
  if (!schema) return {};
  return schema.parse(fields) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Per-Country TIN Validators (TAX-04 / PROF-04)
// ---------------------------------------------------------------------------

/** UAE Tax Registration Number (TRN): exactly 15 digits */
export function validateUaeTin(tin: string): boolean {
  return /^\d{15}$/.test(tin);
}

/** Saudi Tax Identification Number: 13 digits, starts with 3, position 11 is 3 */
export function validateSaudiTin(tin: string): boolean {
  return /^3\d{9}3\d{2}$/.test(tin);
}

/**
 * Polish NIP (Numer Identyfikacji Podatkowej): 10 digits with checksum.
 * Weights: [6, 5, 7, 2, 3, 4, 5, 6, 7]
 */
export function validatePolishNip(nip: string): boolean {
  const cleaned = nip.replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(cleaned)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = cleaned.split('').map(Number);
  const checksum = weights.reduce((sum, w, i) => sum + w * (digits[i] ?? 0), 0) % 11;

  return checksum === digits[9];
}

/** Map of country code to TIN validator */
export const tinValidators: Record<string, (tin: string) => boolean> = {
  AE: validateUaeTin,
  SA: validateSaudiTin,
  PL: validatePolishNip,
};

/**
 * Validate a TIN for a given country code.
 * Returns true if the country has no validator (unknown country).
 */
export function validateTin(countryCode: string, tin: string): boolean {
  const validator = tinValidators[countryCode];
  if (!validator) return true; // No validator for this country
  return validator(tin);
}
