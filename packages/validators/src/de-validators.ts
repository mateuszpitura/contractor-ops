// packages/validators/src/de-validators.ts
//
// German tax-ID validators.
//
// References:
//   ISO/IEC 7064:2003 Pure System MOD 11,10
//   https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064
//   Deutsche Rentenversicherung — Sozialversicherungsnummer structure

import { HANDELSREGISTER_COURTS } from './handelsregister-courts.js';
import type { BundeslandCode } from './steuernummer-formats.js';
import { getSteuernummerRegex, STEUERNUMMER_FORMATS } from './steuernummer-formats.js';

// ---------------------------------------------------------------------------
// ISO 7064 MOD 11,10 Pure System check digit
// ---------------------------------------------------------------------------

/**
 * ISO 7064 MOD 11,10 Pure System check digit for a sequence of digits (0-9).
 *
 * Iterative algorithm (NOT a naive single-pass mod-11 sum).
 * Returns an integer 0-9.
 *
 * Caution: naive `Σ(w_i · d_i) mod 11` is a different algorithm used by
 * Polish NIP and Luhn-family IDs — it yields wrong results for German
 * USt-IdNr and must not be used here.
 */
// biome-ignore lint/style/useNamingConvention: name mirrors ISO 7064 MOD-11-10 algorithm identifier
export function mod11_10CheckDigit(digits: readonly number[]): number {
  let product = 10;
  for (const d of digits) {
    let sum = (d + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return (11 - product) % 10;
}

// ---------------------------------------------------------------------------
// USt-Identifikationsnummer — DE + 9 digits; last is MOD-11-10 check
// ---------------------------------------------------------------------------

/**
 * Validates a German Umsatzsteuer-Identifikationsnummer.
 *
 * Format: `DE` + exactly 9 digits. The 9th digit is the ISO 7064 MOD-11-10
 * check digit over the preceding 8 digits. Input is normalised by stripping
 * whitespace/hyphens and uppercasing before the regex match.
 *
 * Canonical valid vector: `DE136695976` (python-stdnum reference).
 */
export function isValidUstIdNr(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();
  const m = vat.match(/^DE(\d{9})$/);
  if (!m) return false;
  const digits = m[1]?.split('').map(Number);
  const body = digits.slice(0, 8);
  const check = digits[8] ?? 0;
  return mod11_10CheckDigit(body) === check;
}

// ---------------------------------------------------------------------------
// Sozialversicherungsnummer — 12-char structural + weighted mod-10 checksum
// ---------------------------------------------------------------------------

// SV-Nummer weight array [2,1,2,5,7,1,2,1,2,1,2,1] per community DRV sources
// (https://www.deutsche-rentenversicherung.de). Steuerberater review required
// to confirm against ≥5 real vectors before production use.
const SV_WEIGHTS = [2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1] as const;

function digitSum(n: number): number {
  return n >= 10 ? Math.floor(n / 10) + (n % 10) : n;
}

/**
 * Validates a German Sozialversicherungsnummer.
 *
 * Structure (12 characters): `AAGGMMYYBLLP`
 *   AA       = Bereichsnummer (area, 2 digits)
 *   GGMMYY   = Geburtsdatum (6 digits)
 *   B        = Anfangsbuchstabe (one uppercase letter, first of birth surname)
 *   LL       = Seriennummer (2 digits; 00-49 male, 50-99 female/diverse)
 *   P        = Prüfziffer (1 digit)
 *
 * Checksum: letter B is expanded to its two-digit alphabet position
 * (A=01…Z=26); the 12 SV_WEIGHTS are applied across the 13 expanded digits'
 * first 12 positions (area+DOB + letter(2 digits) + serial), each product
 * reduced via digit-sum, summed mod 10.
 *
 * Accepts lowercase input; strips whitespace and hyphens before validation.
 */
export function isValidSvNummer(raw: string): boolean {
  const sv = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{8}[A-Z]\d{3}$/.test(sv)) return false;

  const areaAndDob = sv.slice(0, 8);
  const letter = sv.charCodeAt(8) - 64; // 'A' → 1 … 'Z' → 26
  const serialAndCheck = sv.slice(9);
  const expandedLetter = letter.toString().padStart(2, '0');
  const expanded = (areaAndDob + expandedLetter + serialAndCheck.slice(0, 2)).split('').map(Number);
  const checkDigit = Number(serialAndCheck[2]);

  const sum = SV_WEIGHTS.reduce((acc, w, i) => acc + digitSum(w * (expanded[i] ?? 0)), 0);

  return sum % 10 === checkDigit;
}

// ---------------------------------------------------------------------------
// Steuernummer — dispatcher over Plan 04's per-Bundesland regex map
// ---------------------------------------------------------------------------

/**
 * Validates a German Steuernummer against the supplied Bundesland's regex.
 *
 * Plan 04 owns `steuernummer-formats.ts` with the 16-state regex map.
 * Accepts both slash-separated (`93/815/08152`) and raw-digit
 * (`9381508152`) forms — the per-state regex permits optional slashes.
 *
 * Returns `false` for unknown Bundesland codes (defensive default).
 */
export function isValidSteuernummer(bundesland: string, value: string): boolean {
  const known = STEUERNUMMER_FORMATS.some(f => f.code === bundesland);
  if (!known) return false;
  const rx = getSteuernummerRegex(bundesland as BundeslandCode);
  return rx.test(value);
}

// ---------------------------------------------------------------------------
// Handelsregister — composite (court + HRB/HRA + number ≤ 7 digits)
// ---------------------------------------------------------------------------

const COURT_CODE_SET: ReadonlySet<string> = new Set(HANDELSREGISTER_COURTS.map(c => c.code));

/**
 * Validates the Handelsregister composite identifier.
 *
 * - `court`: must be a known Registergericht code from Plan 04's list.
 * - `type`: either `HRB` (Kapitalgesellschaften) or `HRA` (Personengesellschaften).
 * - `number`: 1-7 digits (maximum per spec).
 *
 * Any missing or malformed part yields `false`. Intended to back a composite
 * Zod schema in Plan 04 that attaches structured error paths.
 */
export function isValidHandelsregister(input: {
  court: string;
  type: 'HRB' | 'HRA';
  number: string;
}): boolean {
  if (!(input.court && COURT_CODE_SET.has(input.court))) return false;
  if (input.type !== 'HRB' && input.type !== 'HRA') return false;
  if (!/^\d{1,7}$/.test(input.number)) return false;
  return true;
}
