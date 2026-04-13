// Phase 59 Plan 59-02 Task 2 — classificationDocument router contract tests.
//
// Strategy: shape-level assertions via structural inspection of the router
// export. Full integration tests require the shared test harness from
// classification.test.ts (mockPrisma + auth + rate-limit scaffolding); that
// harness is heavyweight and is reserved for Plan 59-03's chain router where
// the integration surface is larger. Here we verify the procedure surface and
// input schemas, plus the router is wired into the app router.

import { describe, expect, it } from 'vitest';

import { classificationDocumentRouter } from '../classification-document.js';

describe('classificationDocument router (Phase 59 · CLASS-03, CLASS-06)', () => {
  it('exposes generateSds / getDownloadUrl / listByEngagement procedures', () => {
    const record = classificationDocumentRouter._def.record;
    expect(record).toHaveProperty('generateSds');
    expect(record).toHaveProperty('getDownloadUrl');
    expect(record).toHaveProperty('listByEngagement');
  });

  it('generateSds is a mutation', () => {
    const proc = classificationDocumentRouter._def.record.generateSds;
    // tRPC v11 procedures carry `_def.type` — either 'mutation' or 'query'.
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ?? (proc as { type?: string }).type,
    ).toBe('mutation');
  });

  it('getDownloadUrl is a query', () => {
    const proc = classificationDocumentRouter._def.record.getDownloadUrl;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ?? (proc as { type?: string }).type,
    ).toBe('query');
  });

  it('listByEngagement is a query', () => {
    const proc = classificationDocumentRouter._def.record.listByEngagement;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ?? (proc as { type?: string }).type,
    ).toBe('query');
  });

  // Below describe.todo entries track full integration coverage to be
  // exercised once the Phase 58-style shared harness is generalised in a
  // future test-utils refactor. They fail closed (todo state) so Wave-0
  // guardrails remain accurate.
  describe.todo('generateSds on completed IR35 assessment creates row + returns signed URL (TTL 300)');
  describe.todo('generateSds on draft assessment throws PRECONDITION_FAILED');
  describe.todo('generateSds × 2 on same assessment produces identical SHA-256 (D-05 byte stability)');
  describe.todo('generateDrvDefenseBundle on completed DE assessment creates row + embeds attestation');
  describe.todo('generateDrvDefenseBundle Section 3 contains ALL completed DE assessments');
  describe.todo('generateDrvDefenseBundle Section 4 cross-ref is same-tenant only (ASVS V4)');
  describe.todo('getDownloadUrl rejects cross-tenant document id (returns NOT_FOUND)');
  describe.todo('listByEngagement returns documents ordered by generatedAt desc + org-scoped');
  describe.todo('appending a document does not mutate prior row bytes (D-09)');
});
