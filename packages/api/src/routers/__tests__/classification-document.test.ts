// PLAN_REF: Phase 59 Plans 59-02 (SDS mutation) + 59-04 (DRV mutation) close todos below.
import { describe } from 'vitest';

describe('classificationDocument router (Phase 59 · CLASS-03, CLASS-06)', () => {
  describe.todo('generateSds on completed IR35 assessment creates row + returns signed URL (TTL 300)');
  describe.todo('generateSds on draft assessment throws PRECONDITION_FAILED');
  describe.todo('generateSds × 2 on same assessment produces identical SHA-256 (D-05 byte stability)');
  describe.todo('generateDrvDefenseBundle on completed DE assessment creates row + embeds attestation');
  describe.todo('generateDrvDefenseBundle Section 3 contains ALL completed DE assessments');
  describe.todo('generateDrvDefenseBundle Section 4 cross-ref is same-tenant only (ASVS V4)');
  describe.todo('getDownloadUrl(id) returns 300s signed URL without re-upload');
  describe.todo('getDownloadUrl rejects cross-tenant document id (returns NOT_FOUND)');
  describe.todo('listByEngagement returns documents ordered by generatedAt desc');
  describe.todo('appending a document does not mutate prior row bytes (D-09)');
});
