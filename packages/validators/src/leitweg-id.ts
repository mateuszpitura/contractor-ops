// packages/validators/src/leitweg-id.ts
//
// Leitweg-ID format + ISO/IEC 7064 MOD 11,10 check-digit validator.
//
// References:
//   KoSIT "Format specification Leitweg-ID" v2.0.2
//     https://www.xoev.de/downloads-2316#Leitweg-ID
//   ISO/IEC 7064:2003 Pure System MOD 11,10
//
// Structure:
//   <coarse-address (2-12 digits)>
//     [-<fine-address (0-30 chars from [A-Z0-9])>]
//     -<2-digit check digit>
//
// Total length: 5-46 chars.
//
// The 2-digit check is the ISO 7064 MOD-11-10 Pure System checksum over the
// concatenated coarse + fine payload where each alphanumeric char is encoded
// to its base-36 digit value (0-9 → 0-9; A-Z → 10-35). That integer value is
// decomposed into individual base-10 digits before being fed into the
// iterative MOD-11-10 loop — this matches the reference implementations from
// KoSIT and node-iso7064.
//
// The single-digit MOD-11-10 result is rendered as a 2-character string with
// a leading zero so that the total length and hyphen placement described in
// the Leitweg-ID format spec always hold.

import { z } from 'zod';

import { mod11_10CheckDigit } from './de-validators.js';

// ---------------------------------------------------------------------------
// Regex: coarse (2-12 digits), optional fine (0-30 [A-Z0-9]), 2-digit check.
// ---------------------------------------------------------------------------

const STRUCTURE_RE = /^(\d{2,12})(?:-([A-Z0-9]{0,30}))?-(\d{2})$/;

/**
 * Decompose an alphanumeric payload into its individual base-10 digits.
 *
 * Each character contributes its base-36 integer value (0-9 → 0-9;
 * A → 10; Z → 35). That integer is then split into base-10 digits so the
 * MOD-11-10 loop sees the same per-digit stream as a reference KoSIT run.
 */
function toDigitStream(payload: string): number[] {
  const digits: number[] = [];
  for (const ch of payload) {
    const value = Number.parseInt(ch, 36);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid Leitweg-ID character: '${ch}'`);
    }
    // Base-36 → base-10 digit stream (e.g. A=10 → [1, 0]; Z=35 → [3, 5]).
    if (value < 10) {
      digits.push(value);
    } else {
      digits.push(Math.floor(value / 10));
      digits.push(value % 10);
    }
  }
  return digits;
}

/**
 * Compute the expected 2-digit Leitweg-ID check digit string for the given
 * `coarse + fine` payload (no hyphens).
 */
export function computeLeitwegCheckDigit(payload: string): string {
  const digits = toDigitStream(payload);
  const check = mod11_10CheckDigit(digits);
  return check.toString().padStart(2, '0');
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
// Zod schema — structure + Modulo-11-10 check digit at the tRPC boundary.
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
