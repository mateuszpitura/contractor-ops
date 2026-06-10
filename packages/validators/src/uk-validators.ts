// packages/validators/src/uk-validators.ts
//
// UK tax identifier validators.
//
// These validators are pure functions with no I/O. They run on both client
// (React Hook Form resolvers) and server (tRPC input validation) to catch
// typos at save time. No HMRC live lookup.
//
// References:
//   - UTR:  https://design.tax.service.gov.uk/hmrc-design-patterns/unique-taxpayer-reference/
//           https://www.accountingweb.co.uk/any-answers/utr-validation-formula
//   - VAT:  HMRC VAT Notice 700 / python-stdnum gb.vat module
//   - CH:   https://resources.companieshouse.gov.uk/doc/crproc/v1-9/ch001.shtml
//
// Input normalization: all functions strip whitespace and hyphens before
// validating, and match regex anchors (^...$) to avoid ReDoS on adversarial
// input.

// ---------------------------------------------------------------------------
// UTR (Unique Taxpayer Reference)
// ---------------------------------------------------------------------------

const UTR_WEIGHTS = [6, 7, 8, 9, 10, 5, 4, 3, 2] as const;
const UTR_CHECK_LOOKUP = [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * Validates a UK Unique Taxpayer Reference.
 *
 * Accepts the 10-digit standard form and the 10-digit + `K`/`k` Corporation
 * Tax variant. Strips whitespace and hyphens before checksum validation.
 *
 * Algorithm (HMRC mod-11):
 *   1. Take digits 2..10 (body), apply weights [6,7,8,9,10,5,4,3,2]
 *   2. Sum products, take modulo 11
 *   3. Expected check digit = CHECK_LOOKUP[remainder]
 *   4. Valid iff supplied digit 1 (check digit) == expected
 *
 * @param raw - raw user input (may contain spaces, hyphens, trailing K)
 * @returns true iff the checksum matches
 */
export function isValidUtr(raw: string): boolean {
  const utr = raw.replace(/[\s-]/g, '').replace(/K$/i, '');
  if (!/^\d{10}$/.test(utr)) return false;
  const digits = utr.split('').map(Number);
  const checkDigit = digits[0] ?? 0;
  const sum = UTR_WEIGHTS.reduce((acc, w, i) => acc + w * (digits[i + 1] ?? 0), 0);
  const remainder = sum % 11;
  const expected = UTR_CHECK_LOOKUP[remainder] ?? -1;
  return checkDigit === expected;
}

// ---------------------------------------------------------------------------
// GB VAT Registration Number
// ---------------------------------------------------------------------------

const VAT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;

/**
 * Validates a UK VAT registration number.
 *
 * Accepted forms (all case-insensitive, whitespace and hyphens stripped):
 *   - `GB` + 9 digits       — standard trader (mod-97 OR mod-9755 checksum)
 *   - `GB` + 12 digits      — branch trader: 9-digit body + 3-digit branch id;
 *                             branch id is not checksummed (HMRC spec)
 *   - `GBGD` + 3 digits     — government department (500–999, no checksum)
 *   - `GBHA` + 3 digits     — health authority   (000–499, no checksum)
 *
 * Both mod-97 (pre-2010) and mod-9755 (post-2010) variants are in active
 * circulation. HMRC did not reissue numbers — any given 9-digit body may
 * validate against either scheme, so both MUST be accepted.
 *
 * Algorithm (per 9-digit body):
 *   weighted = Σ VAT_WEIGHTS[i] * digit[i]  for i in 0..6
 *   check    = digit[7] * 10 + digit[8]
 *   mod97    = (97 - weighted % 97) % 97
 *   mod9755  = (97 - (weighted + 55) % 97) % 97
 *   valid iff check == mod97 OR check == mod9755
 *
 * @param raw - raw user input
 * @returns true iff the input matches one of the accepted forms
 */
export function isValidGbVat(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^GBGD[5-9]\d{2}$/.test(vat)) return true;
  if (/^GBHA[0-4]\d{2}$/.test(vat)) return true;
  const match = vat.match(/^GB(\d{9})(?:\d{3})?$/);
  if (!match) return false;
  const body = match[1] ?? '';
  const digits = body.split('').map(Number);
  const check = (digits[7] ?? 0) * 10 + (digits[8] ?? 0);
  const weighted = VAT_WEIGHTS.reduce((sum, w, i) => sum + w * (digits[i] ?? 0), 0);
  const mod97 = (97 - (weighted % 97)) % 97;
  const mod9755 = (97 - ((weighted + 55) % 97)) % 97;
  return check === mod97 || check === mod9755;
}

// ---------------------------------------------------------------------------
// Companies House Number
// ---------------------------------------------------------------------------

/**
 * Validates a Companies House registration number.
 *
 * Accepted forms (case-insensitive, whitespace stripped):
 *   - 1–8 digits            — England / Wales (CH registry pads to 8 digits)
 *   - `SC` + 6 digits       — Scotland
 *   - `NI` + 6 digits       — Northern Ireland
 *   - `OC` + 6 digits       — LLP England / Wales
 *   - `SO` + 6 digits       — LLP Scotland
 *   - `NC` + 6 digits       — LLP Northern Ireland
 *   - `R0` + 6 digits       — Historic pre-2009 registrations
 *
 * This is a structural check only — CH does not publish a checksum
 * algorithm. Live CH API lookup for existence verification is handled in the API layer.
 *
 * @param raw - raw user input
 * @returns true iff the input matches one of the accepted forms
 */
export function isValidCompaniesHouseNumber(raw: string): boolean {
  const clean = raw.replace(/\s/g, '').toUpperCase();
  if (/^\d{1,8}$/.test(clean)) return true;
  if (/^(SC|NI|OC|SO|NC|R0)\d{6}$/.test(clean)) return true;
  return false;
}
