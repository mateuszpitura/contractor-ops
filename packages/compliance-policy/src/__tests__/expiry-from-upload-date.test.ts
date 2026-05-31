// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-04 portal upload-replacement auto-fill expiresAt;
// helper lives in packages/compliance-policy/src/expiry.ts (Plan 73-05).

import { describe, expect, it } from 'vitest';

describe('expiry-from-upload-date fixed_days', () => {
  it('returns uploadDate + 90 days for uk.right_to_work@v3 (90-day share-code)', async () => {
    const mod = await import('../expiry.js');
    expect(mod.defaultExpiryFromUploadDate).toBeTypeOf('function');
    throw new Error('defaultExpiryFromUploadDate not yet implemented');
  });
});

describe('expiry-from-upload-date fixed_months', () => {
  it('returns uploadDate + 24 months for de.a1@v1 (A1 max validity)', async () => {
    throw new Error('fixed_months semantic not yet implemented');
  });

  it('returns uploadDate + 12 months for ksa.iqama@v1 (1-year iqama)', async () => {
    throw new Error('iqama 12-month semantic not yet implemented');
  });
});

describe('expiry-from-upload-date no_expiry', () => {
  it('returns a sentinel far-future date for rules with no fixed expiry', async () => {
    throw new Error('no_expiry sentinel not yet implemented');
  });
});

describe('expiry-semantic-coverage', () => {
  it('every PolicyRule in listPolicyRules() has a non-null expirySemantic field', async () => {
    await import('../index.js'); // side-effect: registers all jurisdiction rules
    const reg = await import('../registry.js');
    const rules = reg.listPolicyRules();
    expect(
      rules.length,
      'registry must be populated for a meaningful coverage check',
    ).toBeGreaterThan(0);
    for (const r of rules) {
      // @ts-expect-error — expirySemantic does not yet exist on PolicyRule
      expect(r.expirySemantic, `Rule ${r.policyRuleId} missing expirySemantic`).toBeDefined();
    }
  });
});
