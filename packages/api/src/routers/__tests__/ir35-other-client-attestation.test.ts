// Phase 59 Plan 59-03 Task 2 — ir35Attestation router contract tests.
import { describe, expect, it } from 'vitest';

import { ir35AttestationRouter } from '../ir35-other-client-attestation.js';

describe('ir35Attestation router (Phase 59 · CLASS-06 support)', () => {
  it('exposes the 3 required procedures', () => {
    const record = ir35AttestationRouter._def.record;
    expect(record).toHaveProperty('getForEngagement');
    expect(record).toHaveProperty('upsert');
    expect(record).toHaveProperty('getPlatformCrossReference');
  });

  it('getForEngagement + getPlatformCrossReference are queries', () => {
    const record = ir35AttestationRouter._def.record;
    for (const key of ['getForEngagement', 'getPlatformCrossReference'] as const) {
      const proc = record[key];
      const type =
        (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type;
      expect(type, `${key} should be a query`).toBe('query');
    }
  });

  it('upsert is a mutation', () => {
    const proc = ir35AttestationRouter._def.record.upsert;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('mutation');
  });

  // Integration coverage tracked as todos (same rationale as classification-document.test.ts).
  describe.todo('upsert sets signedAt only when statementText or signedName changes');
  describe.todo('getPlatformCrossReference returns ONLY same-tenant assignments');
  describe.todo('getPlatformCrossReference excludes the current assignment when excludeAssignmentId is passed');
  describe.todo('statementText > 4000 chars rejected by Zod');
});
