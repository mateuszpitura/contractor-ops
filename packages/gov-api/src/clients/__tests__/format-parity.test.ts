// Format-validator drift regression test.
//
// gov-api inlines minimal DE / GB VAT format checks to avoid a workspace
// dependency cycle (gov-api ← einvoice ← validators ← einvoice). The same
// algorithms live in `@contractor-ops/validators`; if either copy drifts
// without the other, real-world validation will silently disagree.
//
// This test file pins the canonical vectors from the validators package's
// own test suite and re-asserts them against the inline copies. If the
// validators package ever extends coverage (new GBGD ranges, MOD-11-10
// edge cases, etc.) the canonical vectors here MUST be updated to match.
//
// We intentionally do NOT import from `@contractor-ops/validators` — that
// would create a runtime cycle. The vectors are duplicated as plain data;
// this is a behavioural snapshot, not a dependency.

import { describe, expect, it } from 'vitest';

import { isValidGbVatInline } from '../hmrc-vat-client.js';
import { isValidUstIdNrInline } from '../vies-client.js';

// ---------------------------------------------------------------------------
// DE USt-IdNr canonical vectors — mirror packages/validators/src/__tests__/
// de-validators.test.ts > describe('isValidUstIdNr')
// ---------------------------------------------------------------------------

describe('format parity — isValidUstIdNrInline vs canonical isValidUstIdNr vectors', () => {
  it.each([
    ['DE136695976', true], // python-stdnum canonical
    ['DE811569869', true], // Siemens AG (publicly reported)
    ['DE123456788', true], // computed-check-digit happy path
    ['DE123456789', false], // check digit 9 ≠ computed 8
    ['FR12345678', false], // non-DE prefix
    ['DE12345678', false], // 8 digits after DE
    ['DE1234567890', false], // 10 digits after DE
    ['', false],
    ['DE', false],
    ['DEABCDEFGHI', false],
    ['de-136 695 976', true], // whitespace + hyphens stripped
    ['  DE136695976  ', true],
    ['DE-136-695-976', true],
  ])('isValidUstIdNrInline(%s) → %s', (input, expected) => {
    expect(isValidUstIdNrInline(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// GB VAT canonical vectors — mirror packages/validators/src/__tests__/
// uk-validators.test.ts > describe('isValidGbVat')
// ---------------------------------------------------------------------------

describe('format parity — isValidGbVatInline vs canonical isValidGbVat vectors', () => {
  it.each([
    // Standard mod-97 (pre-2010)
    ['GB100000089', true],
    ['GB123456782', true],
    ['GB999999973', true],
    // mod-9755 (post-2010)
    ['GB100000034', true],
    ['GB123456727', true],
    ['GB000000042', true],
    // 12-digit branch-trader
    ['GB100000089001', true],
    ['GB123456782999', true],
    ['GB999999999999', false],
    // GBGD (government department)
    ['GBGD500', true],
    ['GBGD999', true],
    ['GBGD499', false], // below documented range
    ['GBGD1000', false], // wrong length
    // Negatives
    ['GB12345678', false],
    ['GB1234567890', false],
    ['', false],
    ['BAD-FORMAT', false],
  ])('isValidGbVatInline(%s) → %s', (input, expected) => {
    expect(isValidGbVatInline(input)).toBe(expected);
  });
});
