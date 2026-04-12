// packages/validators/src/uk-validators.ts
//
// UK tax identifier validators (Phase 56, Decision D-02).
//
// These validators are pure functions with no I/O. They run on both client
// (React Hook Form resolvers) and server (tRPC input validation) to catch
// typos at save time. No HMRC live lookup — Phase 57 adds that layer.
//
// References:
//   - UTR:  https://design.tax.service.gov.uk/hmrc-design-patterns/unique-taxpayer-reference/
//           https://www.accountingweb.co.uk/any-answers/utr-validation-formula
//
// Input normalization: all functions strip whitespace and hyphens before
// validating, and match regex anchors (^...$) to avoid ReDoS on adversarial
// input (T-56-03).

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
  const checkDigit = digits[0]!;
  const sum = UTR_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i + 1]!, 0);
  const remainder = sum % 11;
  const expected = UTR_CHECK_LOOKUP[remainder]!;
  return checkDigit === expected;
}
