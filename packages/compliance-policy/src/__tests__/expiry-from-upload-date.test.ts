// Phase 73 · Plan 05 — defaultExpiryFromUploadDate tests (D-07).

import { addDays, addMonths, addYears } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { defaultExpiryFromUploadDate } from '../expiry.js';
import '../index.js'; // side-effect: registers all jurisdiction rules
import { listPolicyRules } from '../registry.js';
import type { PolicyRule } from '../types.js';

const UPLOAD_DATE = new Date('2026-04-27T12:00:00.000Z');

function makeRule(overrides: Partial<PolicyRule>): PolicyRule {
  return {
    policyRuleId: 'uk.right_to_work@v1',
    jurisdiction: 'UK',
    documentType: 'COMPLIANCE_PROOF',
    displayName: 'test',
    severity: 'BLOCKING',
    expiryJurisdictionTz: 'Europe/London',
    appliesIf: () => true,
    draftLegalText: '',
    ...overrides,
  };
}

describe('expiry-from-upload-date fixed_days', () => {
  it('returns uploadDate + 90 days for uk.right_to_work@v3 (90-day share-code)', () => {
    const rule = makeRule({
      policyRuleId: 'uk.right_to_work@v3',
      expirySemantic: 'fixed_days',
      expiryDays: 90,
    });
    const out = defaultExpiryFromUploadDate(rule, UPLOAD_DATE);
    expect(out.getTime()).toBe(addDays(UPLOAD_DATE, 90).getTime());
  });
});

describe('expiry-from-upload-date fixed_months', () => {
  it('returns uploadDate + 24 months for de.a1@v1 (A1 max validity)', () => {
    const rule = makeRule({
      policyRuleId: 'de.a1@v1',
      jurisdiction: 'DE',
      expirySemantic: 'fixed_months',
      expiryMonths: 24,
    });
    const out = defaultExpiryFromUploadDate(rule, UPLOAD_DATE);
    expect(out.getTime()).toBe(addMonths(UPLOAD_DATE, 24).getTime());
  });

  it('returns uploadDate + 12 months for ksa.iqama@v1 (1-year iqama)', () => {
    const rule = makeRule({
      policyRuleId: 'ksa.iqama@v1',
      jurisdiction: 'KSA',
      expirySemantic: 'fixed_months',
      expiryMonths: 12,
    });
    const out = defaultExpiryFromUploadDate(rule, UPLOAD_DATE);
    expect(out.getTime()).toBe(addMonths(UPLOAD_DATE, 12).getTime());
  });
});

describe('expiry-from-upload-date no_expiry', () => {
  it('returns a sentinel far-future date for rules with no fixed expiry', () => {
    const rule = makeRule({ policyRuleId: 'uk.utr@v1', expirySemantic: 'no_expiry' });
    const out = defaultExpiryFromUploadDate(rule, UPLOAD_DATE);
    expect(out.getTime()).toBe(addYears(UPLOAD_DATE, 100).getTime());
  });
});

describe('expiry-from-upload-date error-paths', () => {
  it('throws when fixed_days has no expiryDays', () => {
    const rule = makeRule({ expirySemantic: 'fixed_days' });
    expect(() => defaultExpiryFromUploadDate(rule, UPLOAD_DATE)).toThrow(/expiryDays/);
  });

  it('throws when fixed_months has no expiryMonths', () => {
    const rule = makeRule({ expirySemantic: 'fixed_months' });
    expect(() => defaultExpiryFromUploadDate(rule, UPLOAD_DATE)).toThrow(/expiryMonths/);
  });

  it('throws on unknown/missing expirySemantic', () => {
    const rule = makeRule({ expirySemantic: undefined });
    expect(() => defaultExpiryFromUploadDate(rule, UPLOAD_DATE)).toThrow();
  });
});

describe('expiry-semantic-coverage', () => {
  it('every PolicyRule in listPolicyRules() has a non-null expirySemantic field', () => {
    const rules = listPolicyRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.expirySemantic, `Rule ${r.policyRuleId} missing expirySemantic`).toBeDefined();
      if (r.expirySemantic === 'fixed_days') {
        expect(r.expiryDays, `Rule ${r.policyRuleId} fixed_days but no expiryDays`).toBeDefined();
      }
      if (r.expirySemantic === 'fixed_months') {
        expect(
          r.expiryMonths,
          `Rule ${r.policyRuleId} fixed_months but no expiryMonths`,
        ).toBeDefined();
      }
    }
  });
});
