// Content-addressed R2 object-key builder for classification documents.
// Key format: classification-documents/{orgId}/{assessmentId}/{kind}-{ruleSetVersion}-{sha16}.pdf
// Hash in path enables future byte-dedup without schema changes; org prefix is defence-in-depth
// against cross-tenant access even if the tRPC layer misroutes.

import type { ClassificationDocumentKind } from '@contractor-ops/db/generated/prisma/client';

const KIND_PATH_SEGMENT: Record<ClassificationDocumentKind, string> = {
  SDS: 'sds',
  DRV_DEFENSE_BUNDLE: 'drv-defense-bundle',
  DRV_DECISION_LETTER: 'drv-decision-letter',
  US_DETERMINATION_LETTER: 'us-determination-letter',
};

const SHA256_PREFIX_LENGTH = 16;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

export interface BuildClassificationDocumentKeyInput {
  organizationId: string;
  classificationAssessmentId: string;
  kind: ClassificationDocumentKind;
  ruleSetVersion: string;
  sha256: string; // 64-hex-char lowercase
}

export function buildClassificationDocumentKey(input: BuildClassificationDocumentKeyInput): string {
  if (!SHA256_HEX_REGEX.test(input.sha256)) {
    throw new Error(
      `Invalid sha256 hash: expected 64 lowercase hex characters, got "${input.sha256}" (${input.sha256.length} chars).`,
    );
  }
  const kindSegment = KIND_PATH_SEGMENT[input.kind];
  const shaPrefix = input.sha256.slice(0, SHA256_PREFIX_LENGTH);
  return (
    `classification-documents/${input.organizationId}/${input.classificationAssessmentId}` +
    `/${kindSegment}-${input.ruleSetVersion}-${shaPrefix}.pdf`
  );
}

export const CLASSIFICATION_DOCUMENT_KEY_REGEX =
  /^classification-documents\/[^/]+\/[^/]+\/(?:sds|drv-defense-bundle)-[^/]+-[a-f0-9]{16}\.pdf$/;
