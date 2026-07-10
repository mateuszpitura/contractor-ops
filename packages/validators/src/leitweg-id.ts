// packages/validators/src/leitweg-id.ts
//
// Leitweg-ID format + ISO/IEC 7064 MOD 97-10 check-digit validator.
//
// References:
//   KoSIT "Format specification Leitweg-ID" v2.0.2
//     https://www.xoev.de/downloads-2316#Leitweg-ID
//   ISO/IEC 7064:2003 Pure System MOD 97-10 (same family as IBAN check digits)
//
// Structure:
//   <coarse-address (2-12 digits)>
//     [-<fine-address (0-30 chars from [A-Z0-9])>]
//     -<2-digit check digit>
//
// Total length: 5-46 chars.
//
// Check-digit generation (simplified MOD 97-10 procedure from the spec):
//   1. Concatenate coarse + fine payload without hyphens.
//   2. Expand each character to base-36 digits (0-9 → 0-9; A-Z → 10-35).
//   3. Append "00" as check-digit placeholders.
//   4. Compute remainder mod 97 over the expanded decimal string.
//   5. Check digit = 98 − remainder, rendered as two decimal digits.
//
// Validation: expand coarse + fine + check digit the same way; remainder mod 97
// must equal 1.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Regex: coarse (2-12 digits), optional fine (0-30 [A-Z0-9]), 2-digit check.
// ---------------------------------------------------------------------------

const STRUCTURE_RE = /^(\d{2,12})(?:-([A-Z0-9]{0,30}))?-(\d{2})$/;

/**
 * Expand an alphanumeric payload into the decimal string fed to MOD 97-10.
 * Each character contributes its base-36 integer value (0-9 → 0-9;
 * A → 10; Z → 35) as decimal digits without separators.
 */
function expandPayloadDigits(payload: string): string {
  let expanded = '';
  for (const ch of payload) {
    const value = Number.parseInt(ch, 36);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid Leitweg-ID character: '${ch}'`);
    }
    expanded += String(value);
  }
  return expanded;
}

function mod97Remainder(expandedDigits: string): number {
  let remainder = 0;
  for (const digit of expandedDigits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

/**
 * Compute the expected 2-digit Leitweg-ID check digit string for the given
 * `coarse + fine` payload (no hyphens).
 */
export function computeLeitwegCheckDigit(payload: string): string {
  const expanded = `${expandPayloadDigits(payload)}00`;
  const remainder = mod97Remainder(expanded);
  const check = 98 - remainder;
  return String(check).padStart(2, '0');
}

/**
 * Validate a Leitweg-ID check digit against the supplied `coarse + fine`
 * payload. Returns both the boolean result and the expected digit so caller
 * diagnostics can surface "expected XY, got ZZ" in the UI if needed.
 */
export function validateLeitwegCheckDigit(
  payload: string,
  provided: string,
): { valid: boolean; expected: string } {
  let expected: string;
  try {
    expected = computeLeitwegCheckDigit(payload);
  } catch {
    return { valid: false, expected: '??' };
  }
  return { valid: expected === provided, expected };
}

// ---------------------------------------------------------------------------
// Zod schema — structure + Modulo-97-10 check digit at the tRPC boundary.
// ---------------------------------------------------------------------------

export const leitwegIdSchema = z
  .string()
  .min(5, 'Leitweg-ID too short')
  .max(46, 'Leitweg-ID too long')
  .regex(STRUCTURE_RE, 'Leitweg-ID structure invalid')
  .refine(
    value => {
      const match = STRUCTURE_RE.exec(value);
      if (!match) return false;
      const [, coarse, fine, check] = match;
      const payload = `${coarse}${fine ?? ''}`;
      return validateLeitwegCheckDigit(payload, check ?? '').valid;
    },
    { message: 'Leitweg-ID check digit invalid' },
  );

export type LeitwegId = z.infer<typeof leitwegIdSchema>;

// ---------------------------------------------------------------------------
// Peppol participant pair constraint.
// ---------------------------------------------------------------------------
//
// `Contractor.peppolSchemeId` and `Contractor.peppolParticipantValue` are
// strictly paired: either BOTH are set (the contractor is registered on the
// Peppol SML) or BOTH are null (no Peppol routing known yet). Persisting a
// half-set pair would break the capability lookup and the pre-send SML call
// with opaque errors; the Zod refine catches it at the tRPC boundary so the
// DB never sees an inconsistent state.
//
// The scheme-id regex mirrors Peppol's ICD list (0060 Companies House, 0088
// GLN, 0106 DUNS, 0192 OrgNr, 0208 BE, 9957 DE, …) — always exactly 4 digits.
// Participant values are capped at 64 chars (Storecove's documented max).

const PEPPOL_SCHEME_ID_RE = /^\d{4}$/;

export const peppolParticipantPairSchema = z
  .object({
    peppolSchemeId: z
      .string()
      .regex(PEPPOL_SCHEME_ID_RE, 'Peppol schemeId must be 4 digits')
      .nullable(),
    peppolParticipantValue: z
      .string()
      .min(1, 'Peppol participant value cannot be empty')
      .max(64, 'Peppol participant value too long')
      .nullable(),
  })
  .refine(
    d =>
      (d.peppolSchemeId === null && d.peppolParticipantValue === null) ||
      (d.peppolSchemeId !== null && d.peppolParticipantValue !== null),
    {
      message: 'peppolSchemeId and peppolParticipantValue must both be set or both be null',
      path: ['peppolParticipantValue'],
    },
  );

export type PeppolParticipantPair = z.infer<typeof peppolParticipantPairSchema>;
