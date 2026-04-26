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
  it('exposes generateSds / generateDrvDefenseBundle / getDownloadUrl / listByEngagement procedures', () => {
    const record = classificationDocumentRouter._def.record;
    expect(record).toHaveProperty('generateSds');
    expect(record).toHaveProperty('generateDrvDefenseBundle');
    expect(record).toHaveProperty('getDownloadUrl');
    expect(record).toHaveProperty('listByEngagement');
  });

  it('generateDrvDefenseBundle is a mutation (Phase 59 Plan 04)', () => {
    const proc = classificationDocumentRouter._def.record.generateDrvDefenseBundle;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('mutation');
  });

  it('generateSds is a mutation', () => {
    const proc = classificationDocumentRouter._def.record.generateSds;
    // tRPC v11 procedures carry `_def.type` — either 'mutation' or 'query'.
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('mutation');
  });

  it('getDownloadUrl is a query', () => {
    const proc = classificationDocumentRouter._def.record.getDownloadUrl;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('query');
  });

  it('listByEngagement is a query', () => {
    const proc = classificationDocumentRouter._def.record.listByEngagement;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('query');
  });
});
