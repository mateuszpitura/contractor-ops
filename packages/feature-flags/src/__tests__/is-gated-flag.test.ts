// Phase 70 · Plan 05 · FOUND6-04 (D-11) — gated namespace prefix coverage.

import { describe, expect, it } from 'vitest';

import { GATED_FLAG_NAMESPACE_PREFIXES, isGatedFlag } from '../signoff-registry-flags.js';

describe('isGatedFlag (FOUND6-04 — D-11)', () => {
  it('matches every prefix in GATED_FLAG_NAMESPACE_PREFIXES', () => {
    expect(GATED_FLAG_NAMESPACE_PREFIXES).toContain('compliance-');
    expect(GATED_FLAG_NAMESPACE_PREFIXES).toContain('idp-deprovisioning');
    expect(GATED_FLAG_NAMESPACE_PREFIXES).toContain('gulf-');
    expect(GATED_FLAG_NAMESPACE_PREFIXES).toContain('offboarding-ip-');
  });

  it('returns true for compliance-* keys', () => {
    expect(isGatedFlag('compliance-portal-self-service')).toBe(true);
    expect(isGatedFlag('compliance-de-archiving')).toBe(true);
  });

  it('returns true for idp-deprovisioning* keys', () => {
    expect(isGatedFlag('idp-deprovisioning')).toBe(true);
    expect(isGatedFlag('idp-deprovisioning-google')).toBe(true);
  });

  it('returns true for gulf-* keys', () => {
    expect(isGatedFlag('gulf-payments')).toBe(true);
    expect(isGatedFlag('gulf-zatca-step-2')).toBe(true);
  });

  it('returns true for offboarding-ip-* keys', () => {
    expect(isGatedFlag('offboarding-ip-clause-detector')).toBe(true);
  });

  it('returns false for module.* keys (Phase 64 disclaimer signoff territory — different gate)', () => {
    expect(isGatedFlag('module.classification-engine')).toBe(false);
    expect(isGatedFlag('module.legal-approval')).toBe(false);
  });

  it('returns false for payments.* keys (Phase 63 territory — different concern)', () => {
    expect(isGatedFlag('payments.bacs-enabled')).toBe(false);
    expect(isGatedFlag('payments.skonto-enabled')).toBe(false);
  });

  it('returns false for kill-switch keys', () => {
    expect(isGatedFlag('killswitch.ai-invoice-parser')).toBe(false);
  });
});
