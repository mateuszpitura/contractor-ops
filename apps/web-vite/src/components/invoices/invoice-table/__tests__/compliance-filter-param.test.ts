/**
 * Pure URL-param parsing tests for the e-invoice compliance client-side
 * filter. The legacy test (apps/web/.../einvoice-compliance-filter-chips.test.tsx)
 * mixed parseFilterParam unit cases with chip-rendering integration cases;
 * here we keep only the pure parser cases — the chip component is covered
 * by Playwright in apps/web-vite.
 */

import { describe, expect, it } from 'vitest';
import type { EInvoiceComplianceFilter } from '../compliance-filter-param.js';
import { COMPLIANCE_FILTER_VALUES, parseFilterParam } from '../compliance-filter-param.js';

describe('parseFilterParam', () => {
  it('returns ["all"] for null input', () => {
    expect(parseFilterParam(null)).toEqual(['all']);
  });

  it('returns ["all"] for an empty string', () => {
    expect(parseFilterParam('')).toEqual(['all']);
  });

  it('parses comma-separated tokens and filters unknown ones', () => {
    expect(parseFilterParam('invalid,failed,garbage')).toEqual(['invalid', 'failed']);
  });

  it('trims surrounding whitespace around each token', () => {
    expect(parseFilterParam(' invalid , failed ')).toEqual(['invalid', 'failed']);
  });

  it('short-circuits to ["all"] when `all` is present in a multi-select', () => {
    expect(parseFilterParam('all,invalid')).toEqual(['all']);
  });

  it('falls back to ["all"] when every token is unknown', () => {
    expect(parseFilterParam('garbage,nope')).toEqual(['all']);
  });

  it('accepts every value listed in COMPLIANCE_FILTER_VALUES exactly once', () => {
    for (const value of COMPLIANCE_FILTER_VALUES) {
      const parsed = parseFilterParam(value);
      expect(parsed).toEqual([value as EInvoiceComplianceFilter]);
    }
  });

  it('preserves caller order for non-"all" multi-selects', () => {
    expect(parseFilterParam('failed,warnings,invalid')).toEqual(['failed', 'warnings', 'invalid']);
  });
});
