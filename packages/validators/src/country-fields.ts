import { z } from "zod";

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
// Country Fields Union
// ---------------------------------------------------------------------------

export const countryFieldsSchemaMap: Record<string, z.ZodTypeAny> = {
  AE: uaeCountryFieldsSchema,
  SA: saudiCountryFieldsSchema,
};

/**
 * Validate country fields for a given country code.
 * Returns parsed fields or throws ZodError.
 */
export function validateCountryFields(
  countryCode: string,
  fields: unknown
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
  const cleaned = nip.replace(/[-\s]/g, "");
  if (!/^\d{10}$/.test(cleaned)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = cleaned.split("").map(Number);
  const checksum = weights.reduce((sum, w, i) => sum + w * digits[i]!, 0) % 11;

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
