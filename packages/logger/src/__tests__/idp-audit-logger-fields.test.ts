import { describe, expect, it } from 'vitest';
import { IDP_AUDIT_ALLOWED_FIELDS } from '../idp-audit-logger';

describe('IDP_AUDIT_ALLOWED_FIELDS (Phase 76 D-15 audit-fields extension)', () => {
  const phase76Fields = [
    'runId',
    'stepId',
    'stepKind',
    'requestSha256',
    'responseSha256',
    'attempts',
    'failureKind',
    'matchedProvenanceId',
  ] as const;

  for (const field of phase76Fields) {
    it(`includes "${field}" in the allow-list`, () => {
      expect(IDP_AUDIT_ALLOWED_FIELDS).toContain(field);
    });
  }
});
