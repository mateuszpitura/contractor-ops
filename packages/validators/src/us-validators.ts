// packages/validators/src/us-validators.ts
//
// US tax identifier validators.
//
// These validators are pure functions with no I/O. They run on both client
// (React Hook Form resolvers) and server (tRPC input validation) to catch
// typos at save time. No IRS / SSA live lookup.
//
// Input normalization: all functions strip whitespace and hyphens before
// validating, and match anchored regex (^...$) to avoid ReDoS on adversarial
// input.
//
// References:
//   - EIN: https://www.irs.gov/businesses/small-businesses-self-employed/how-eins-are-assigned-and-valid-ein-prefixes
//   - SSN: https://www.ssa.gov/employer/randomizationfaqs.html (invalid ranges)

// ---------------------------------------------------------------------------
// EIN (Employer Identification Number)
// ---------------------------------------------------------------------------

// IRS valid two-digit campus prefixes [CITED: irs.gov valid-ein-prefixes].
//
// LOCAL-ONLY: Table accuracy needs verification by a jurisdiction-specific
// legal/tax adviser before production deploy. Cross-source lists vary on a few
// prefixes (e.g. 07/08/09/17-19/28/29/49/69/70/78/79/89/96/97 reported invalid
// by a secondary source); the set below follows the IRS campus list and is
// intentionally annotated as adviser-deferred.
const VALID_EIN_PREFIXES = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '77',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '98',
  '99',
]);

/**
 * Validates a US Employer Identification Number.
 *
 * Accepts the canonical `XX-XXXXXXX` form (2-digit campus prefix + 7-digit
 * serial), with or without the hyphen, after stripping whitespace. The 2-digit
 * prefix must be in the IRS-published valid set.
 *
 * @param raw - raw user input (may contain spaces, hyphen separator)
 * @returns true iff the input is a 2+7-digit EIN with a valid IRS prefix
 */
export function isValidEin(raw: string): boolean {
  const match = raw.replace(/\s/g, '').match(/^(\d{2})-?(\d{7})$/);
  if (!match) return false;
  return VALID_EIN_PREFIXES.has(match[1] ?? '');
}

// ---------------------------------------------------------------------------
// SSN (Social Security Number)
// ---------------------------------------------------------------------------

/**
 * Validates a US Social Security Number by format + invalid-range exclusion.
 *
 * Accepts `XXX-XX-XXXX` (area-group-serial), with or without separators, after
 * stripping whitespace and hyphens. Rejects the SSA-published invalid ranges:
 *   - area 000, 666, or 900-999
 *   - group 00
 *   - serial 0000
 *
 * Since SSN randomization (2011-06-25) there is no geographic significance, so
 * validation is range-exclusion only — no area-to-state table.
 *
 * LOCAL-ONLY: SSA invalid-range rules need verification by a jurisdiction-
 * specific legal/tax adviser before production deploy.
 *
 * @param raw - raw user input (may contain spaces, hyphen separators)
 * @returns true iff the input is a structurally valid, in-range SSN
 */
export function isValidSsn(raw: string): boolean {
  const match = raw.replace(/[\s-]/g, '').match(/^(\d{3})(\d{2})(\d{4})$/);
  if (!match) return false;
  const [, area, group, serial] = match;
  const areaNum = Number(area);
  if (areaNum === 0 || areaNum === 666 || areaNum >= 900) return false;
  if (group === '00') return false;
  if (serial === '0000') return false;
  return true;
}
