import { describe, expect, it } from 'vitest';

import {
  buildClassificationDocumentKey,
  CLASSIFICATION_DOCUMENT_KEY_REGEX,
} from '../classification-document-keys';

const VALID_SHA = 'a1b2c3d4e5f6789001a2b3c4d5e6f70811223344556677889900aabbccddeeff';

describe('buildClassificationDocumentKey (Phase 59 D-07)', () => {
  it('builds an SDS key with sds- prefix and 16-char hash suffix', () => {
    const key = buildClassificationDocumentKey({
      organizationId: 'org_abc',
      classificationAssessmentId: 'ca_xyz',
      kind: 'SDS',
      ruleSetVersion: 'ir35-v2',
      sha256: VALID_SHA,
    });
    expect(key).toBe('classification-documents/org_abc/ca_xyz/sds-ir35-v2-a1b2c3d4e5f67890.pdf');
    expect(CLASSIFICATION_DOCUMENT_KEY_REGEX.test(key)).toBe(true);
  });

  it('builds a DRV defense bundle key with drv-defense-bundle- prefix', () => {
    const key = buildClassificationDocumentKey({
      organizationId: 'org_abc',
      classificationAssessmentId: 'ca_xyz',
      kind: 'DRV_DEFENSE_BUNDLE',
      ruleSetVersion: 'schein-v3',
      sha256: VALID_SHA,
    });
    expect(key).toBe(
      'classification-documents/org_abc/ca_xyz/drv-defense-bundle-schein-v3-a1b2c3d4e5f67890.pdf',
    );
    expect(CLASSIFICATION_DOCUMENT_KEY_REGEX.test(key)).toBe(true);
  });

  it('throws on sha256 shorter than 64 hex chars', () => {
    expect(() =>
      buildClassificationDocumentKey({
        organizationId: 'o',
        classificationAssessmentId: 'a',
        kind: 'SDS',
        ruleSetVersion: 'v1',
        sha256: 'abcd',
      }),
    ).toThrow(/Invalid sha256 hash/);
  });

  it('throws on sha256 with uppercase hex', () => {
    expect(() =>
      buildClassificationDocumentKey({
        organizationId: 'o',
        classificationAssessmentId: 'a',
        kind: 'SDS',
        ruleSetVersion: 'v1',
        sha256: VALID_SHA.toUpperCase(),
      }),
    ).toThrow(/Invalid sha256 hash/);
  });

  it('CLASSIFICATION_DOCUMENT_KEY_REGEX rejects malformed keys', () => {
    expect(CLASSIFICATION_DOCUMENT_KEY_REGEX.test('some-other-bucket-key.pdf')).toBe(false);
    expect(
      CLASSIFICATION_DOCUMENT_KEY_REGEX.test(
        'classification-documents/org/ca/unknown-kind-v1-a1b2c3d4e5f67890.pdf',
      ),
    ).toBe(false);
  });
});
