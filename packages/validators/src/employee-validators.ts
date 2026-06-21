// packages/validators/src/employee-validators.ts
//
// Greenfield statutory-identifier validators for the per-market employee
// registry (PL / DE / UK / SA / AE). Pure functions, no I/O — they run on both
// the client (React Hook Form resolvers) and the server (tRPC input validation)
// to catch typos at save time. No live government lookup.
//
// Input normalization: every function strips separators and uppercases before
// matching an anchored `^...$` regex (ReDoS-safe on adversarial input), then
// applies the documented checksum.
//
// References:
//   PESEL structure + Σ(w·d) mod 10 checksum — https://en.wikipedia.org/wiki/PESEL
//   Steuer-IdNr ISO 7064 MOD 11,10 + digit-uniqueness — https://arthurdejong.org/python-stdnum/doc/
//   UK NI number format + DWP exclusions — GOV.UK HMRC NIM39110
//   UK tax code grammar — GOV.UK PAYE manual PAYE11045/PAYE11075
//   Saudi national ID / Iqama (Luhn + leading-digit type) — SAP KB 2384001
//   Emirates ID format 784-YYYY-NNNNNNN-N — ICP; Luhn checksum is advisory only

import { mod11_10CheckDigit } from './de-validators.js';

// ---------------------------------------------------------------------------
// PESEL — Σ(w·d) mod 10 weighted checksum + embedded date-of-birth cross-check
// ---------------------------------------------------------------------------

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] as const;

// PESEL encodes the birth century in the month field: 80→1800s, 00→1900s,
// 20→2000s, 40→2100s, 60→2200s. The real month is `mmRaw % 20`.
const PESEL_CENTURY_OFFSET: Record<number, number> = {
  0: 1900,
  20: 2000,
  40: 2100,
  60: 2200,
  80: 1800,
};

function peselDateIsValid(yy: number, mmRaw: number, dd: number): boolean {
  const centuryKey = mmRaw - (mmRaw % 20);
  const century = PESEL_CENTURY_OFFSET[centuryKey];
  if (century === undefined) return false;
  const month = mmRaw % 20;
  if (month < 1 || month > 12) return false;
  const year = century + yy;
  const date = new Date(Date.UTC(year, month - 1, dd));
  // Round-trip guard rejects impossible days (e.g. 31 Feb rolls into March).
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === dd
  );
}

/**
 * Validates a Polish PESEL (Powszechny Elektroniczny System Ewidencji Ludności).
 *
 * Two independent checks must both pass:
 *   1. the weighted Σ(w·d) mod 10 check digit (weights 1,3,7,9 repeating);
 *   2. the embedded date of birth (century-encoded month) is a real calendar date.
 *
 * Canonical valid vector: `44051401359` (check digit 9).
 *
 * @param raw - 11-digit PESEL (no separators expected; whitespace tolerated)
 * @returns true iff the structure, checksum, and embedded DOB are all valid
 */
export function isValidPesel(raw: string): boolean {
  const pesel = raw.replace(/\s/g, '');
  if (!/^\d{11}$/.test(pesel)) return false;

  const digits = pesel.split('').map(Number);
  const sum = PESEL_WEIGHTS.reduce((acc, w, i) => acc + w * (digits[i] ?? 0), 0);
  const check = (10 - (sum % 10)) % 10;
  if (check !== digits[10]) return false;

  const yy = Number(pesel.slice(0, 2));
  const mmRaw = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));
  return peselDateIsValid(yy, mmRaw, dd);
}

// ---------------------------------------------------------------------------
// Steuer-IdNr — ISO 7064 MOD 11,10 + "exactly one digit repeats 2-or-3×" rule
// ---------------------------------------------------------------------------

/**
 * Returns true iff exactly one digit appears either two or three times across
 * the first ten positions and every other digit appears exactly once — the
 * structural uniqueness rule that distinguishes a real Steuer-IdNr from an
 * arbitrary 11-digit number with a coincidentally valid check digit.
 */
function steuerIdNrUniquenessHolds(firstTen: string): boolean {
  const counts = new Map<string, number>();
  for (const ch of firstTen) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const repeated = [...counts.values()].filter(c => c > 1);
  return repeated.length === 1 && (repeated[0] === 2 || repeated[0] === 3);
}

/**
 * Validates a German Steuer-Identifikationsnummer (lifelong tax ID).
 *
 * Format: 11 digits, the first must be 1-9. The 11th digit is the ISO 7064
 * MOD 11,10 check over the first ten digits (NOT a naive Σ(w·d) mod 11 — that
 * is the PESEL/NIP algorithm and is wrong here), and the first ten digits must
 * satisfy the digit-uniqueness rule.
 *
 * Canonical valid vector: `36574261809`; rejects `36554266806` (uniqueness).
 *
 * @param raw - 11-digit Steuer-IdNr (slashes/whitespace tolerated)
 * @returns true iff format, uniqueness rule, and MOD 11,10 check all pass
 */
export function isValidSteuerIdNr(raw: string): boolean {
  const idnr = raw.replace(/[\s/]/g, '');
  if (!/^[1-9]\d{10}$/.test(idnr)) return false;

  const firstTen = idnr.slice(0, 10);
  if (!steuerIdNrUniquenessHolds(firstTen)) return false;

  const digits = firstTen.split('').map(Number);
  return mod11_10CheckDigit(digits) === Number(idnr[10]);
}

// ---------------------------------------------------------------------------
// UK National Insurance number — format + DWP prefix/letter exclusions
// ---------------------------------------------------------------------------

// Letters never valid in either of the two prefix positions (GOV.UK NIM39110).
const NI_DISALLOWED_LETTERS: ReadonlySet<string> = new Set(['D', 'F', 'I', 'Q', 'U', 'V']);
// Two-letter prefixes administratively reserved / never allocated.
const NI_DISALLOWED_PREFIXES: ReadonlySet<string> = new Set([
  'BG',
  'GB',
  'KN',
  'NK',
  'NT',
  'TN',
  'ZZ',
]);

/**
 * Validates a UK National Insurance number.
 *
 * Structure: two prefix letters, six digits, one suffix letter A-D. The DWP
 * exclusions: neither prefix letter may be D, F, I, Q, U or V; the second
 * prefix letter may not be O; and the two-letter prefix may not be one of the
 * reserved combinations (BG, GB, KN, NK, NT, TN, ZZ).
 *
 * @param raw - NI number (spaces/hyphens tolerated, case-insensitive)
 * @returns true iff the format and every DWP exclusion check out
 */
export function isValidNiNumber(raw: string): boolean {
  const ni = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{6}[A-D]$/.test(ni)) return false;

  const first = ni[0] ?? '';
  const second = ni[1] ?? '';
  if (NI_DISALLOWED_LETTERS.has(first) || NI_DISALLOWED_LETTERS.has(second)) return false;
  if (second === 'O') return false;
  if (NI_DISALLOWED_PREFIXES.has(first + second)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// UK tax code — 1257L grammar + emergency / K-prefix / special codes
// ---------------------------------------------------------------------------

// Optional Scottish/Welsh jurisdiction prefix (S/C), then either a suffix code
// (1-4 digits + L/M/N/T), a K-prefix negative-allowance code, or one of the
// fixed special codes (0T/BR/D0/D1/NT), optionally followed by an emergency
// marker (W1/M1/X). Anchored to stay ReDoS-safe.
const UK_TAX_CODE_REGEX =
  /^(?:[SC])?(?:(?:\d{1,4}[LMNT])|(?:K\d{1,4})|0T|BR|D0|D1|NT)(?:\s?(?:W1|M1|X))?$/i;

/**
 * Validates a UK PAYE tax code (e.g. `1257L`, `K1257`, `BR`, `0T`, `S1257L`,
 * `1257L W1`). Rejects non-codes and more-than-four-digit suffix codes.
 *
 * @param raw - tax code (case-insensitive, optional single space before W1/M1/X)
 * @returns true iff the code matches the HMRC tax-code grammar
 */
export function isValidUkTaxCode(raw: string): boolean {
  return UK_TAX_CODE_REGEX.test(raw.trim());
}

// ---------------------------------------------------------------------------
// Saudi national ID / Iqama — standard Luhn + leading digit (1=citizen, 2=resident)
// ---------------------------------------------------------------------------

/**
 * Standard right-to-left Luhn (mod 10) over a numeric string. The rightmost
 * digit is treated as the check digit (never doubled); every second digit
 * moving left is doubled with the >9 carry folded by subtracting 9.
 */
function passesLuhn(numeric: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = numeric.length - 1; i >= 0; i--) {
    let d = Number(numeric[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Classifies a Saudi national ID / Iqama by leading digit, gated on a valid
 * Luhn check.
 *
 * Returns `1` for a Luhn-valid citizen ID (leading 1), `2` for a Luhn-valid
 * resident Iqama (leading 2), and `false` for anything else — a failing Luhn,
 * a non-1/2 leading digit, or a malformed length.
 *
 * @param raw - 10-digit Saudi ID / Iqama
 * @returns 1 | 2 | false (never a bare boolean true)
 */
export function classifySaudiId(raw: string): 1 | 2 | false {
  const id = raw.replace(/\s/g, '');
  if (!/^[12]\d{9}$/.test(id)) return false;
  if (!passesLuhn(id)) return false;
  return id[0] === '1' ? 1 : 2;
}

// ---------------------------------------------------------------------------
// Emirates ID — strict format gate; Luhn checksum is ADVISORY ONLY
// ---------------------------------------------------------------------------

export interface EmiratesIdResult {
  /** Authoritative gate: true iff the 784-YYYY-NNNNNNN-N structure matches. */
  formatValid: boolean;
  /**
   * Soft advisory: the (Σ first-14-digits × 9) mod 10 check against the final
   * digit. Documented to produce false negatives against ICP databases, so it
   * NEVER turns a format-valid ID into a hard reject — UI surfaces an amber
   * advisory, never a blocking error.
   */
  checksumValid: boolean;
}

const EMIRATES_ID_FORMAT_REGEX = /^784-\d{4}-\d{7}-\d$/;

/**
 * Validates an Emirates ID into a structured result. `formatValid` is the
 * authoritative gate (strict `784-YYYY-NNNNNNN-N` structure); `checksumValid`
 * is an advisory-only Luhn-variant signal that must never be used to reject a
 * format-valid ID.
 *
 * @param raw - Emirates ID in dashed form `784-1990-1234567-1`
 * @returns `{ formatValid, checksumValid }` — checksum is advisory only
 */
export function isValidEmiratesId(raw: string): EmiratesIdResult {
  const eid = raw.trim();
  const formatValid = EMIRATES_ID_FORMAT_REGEX.test(eid);
  if (!formatValid) return { formatValid: false, checksumValid: false };

  const digits = eid.replace(/-/g, '');
  const first14 = digits
    .slice(0, 14)
    .split('')
    .map(Number)
    .reduce((acc, d) => acc + d, 0);
  const checksumValid = (first14 * 9) % 10 === Number(digits[14]);
  return { formatValid: true, checksumValid };
}

// ---------------------------------------------------------------------------
// Saudi GOSI + UAE WPS — lenient employer-registration formats (adviser-verify)
// ---------------------------------------------------------------------------

/**
 * Validates a Saudi GOSI registration number.
 *
 * No authoritative public checksum spec exists, so this is a lenient 9-digit
 * format check pending payroll-adviser verification (adviser-verify).
 *
 * @param raw - GOSI registration number
 * @returns true iff the value is exactly nine digits
 */
export function isValidGosi(raw: string): boolean {
  return /^\d{9}$/.test(raw.replace(/\s/g, ''));
}

/**
 * Validates a UAE WPS (Wage Protection System) Establishment ID.
 *
 * The MOL identifier is up to 13 digits, leading-zero padded, with no public
 * checksum — lenient format-only check pending Gulf-adviser verification.
 *
 * @param raw - WPS Establishment ID
 * @returns true iff the value is 1-13 digits
 */
export function isValidWpsEstablishmentId(raw: string): boolean {
  return /^\d{1,13}$/.test(raw.replace(/\s/g, ''));
}
