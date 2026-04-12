import { describe, expect, it } from 'vitest';
import {
  bulkGrantConsentSchema,
  isPdplJurisdiction,
  requiresPrivacyAcknowledgement,
} from '../consent.js';

describe('consent — jurisdiction predicates', () => {
  describe('isPdplJurisdiction (unchanged behaviour)', () => {
    it.each(['AE', 'SA'])('returns true for %s', code => {
      expect(isPdplJurisdiction(code)).toBe(true);
    });

    it.each(['GB', 'DE', 'PL', 'EU', '', null, undefined])(
      'returns false for %s',
      code => {
        expect(isPdplJurisdiction(code)).toBe(false);
      },
    );
  });

  describe('requiresPrivacyAcknowledgement (Phase 56 · Plan 08, D-10)', () => {
    it.each(['AE', 'SA', 'GB', 'DE'])('returns true for %s', code => {
      expect(requiresPrivacyAcknowledgement(code)).toBe(true);
    });

    it('is case-insensitive on UK/DE codes', () => {
      expect(requiresPrivacyAcknowledgement('gb')).toBe(true);
      expect(requiresPrivacyAcknowledgement('de')).toBe(true);
    });

    it.each(['PL', 'US', 'FR', 'EU', '', null, undefined])(
      'returns false for %s',
      code => {
        expect(requiresPrivacyAcknowledgement(code)).toBe(false);
      },
    );
  });
});

describe('bulkGrantConsentSchema — privacy acknowledgement fields', () => {
  const baseConsents = [
    { purpose: 'CONTRACTOR_DATA_PROCESSING', granted: true },
  ] as const;

  it('accepts payload without acknowledgement (existing PDPL flow)', () => {
    const parsed = bulkGrantConsentSchema.parse({ consents: baseConsents });
    expect(parsed.privacyNoticeAcknowledged).toBeUndefined();
    expect(parsed.privacyNoticeJurisdiction).toBeUndefined();
    expect(parsed.privacyNoticeVersion).toBeUndefined();
  });

  it('accepts payload with acknowledgement metadata', () => {
    const parsed = bulkGrantConsentSchema.parse({
      consents: baseConsents,
      privacyNoticeAcknowledged: true,
      privacyNoticeJurisdiction: 'DE',
      privacyNoticeVersion: 1,
    });
    expect(parsed.privacyNoticeAcknowledged).toBe(true);
    expect(parsed.privacyNoticeJurisdiction).toBe('DE');
    expect(parsed.privacyNoticeVersion).toBe(1);
  });

  it('rejects invalid jurisdiction code', () => {
    expect(() =>
      bulkGrantConsentSchema.parse({
        consents: baseConsents,
        privacyNoticeJurisdiction: 'XX',
      }),
    ).toThrow();
  });

  it('rejects non-positive notice version', () => {
    expect(() =>
      bulkGrantConsentSchema.parse({
        consents: baseConsents,
        privacyNoticeVersion: 0,
      }),
    ).toThrow();
  });
});
