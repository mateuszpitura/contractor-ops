import { describe, expect, it } from 'vitest';

import { triggerReasonSchema, triggerReasonsSchema } from '../reassessment-trigger-reason';

describe('triggerReasonSchema', () => {
  it('parses a well-formed reason (happy path)', () => {
    const input = {
      field: 'activeTo',
      oldValue: '2026-01-01',
      newValue: '2027-01-01',
      auditLogId: 'aud_123',
      resourceType: 'CONTRACTOR' as const,
    };
    const out = triggerReasonSchema.parse(input);
    expect(out.field).toBe('activeTo');
    expect(out.auditLogId).toBe('aud_123');
    expect(out.resourceType).toBe('CONTRACTOR');
  });

  it('rejects rows missing auditLogId', () => {
    expect(() =>
      triggerReasonSchema.parse({
        field: 'activeTo',
        oldValue: '2026-01-01',
        newValue: '2027-01-01',
        resourceType: 'CONTRACTOR',
      }),
    ).toThrow();
  });

  it('rejects unknown resourceType', () => {
    expect(() =>
      triggerReasonSchema.parse({
        field: 'activeTo',
        auditLogId: 'aud_123',
        resourceType: 'WORKFLOW_RUN',
      }),
    ).toThrow();
  });
});

describe('triggerReasonsSchema', () => {
  it('parses an array of reasons', () => {
    const input = [
      { field: 'activeTo', auditLogId: 'aud_1', resourceType: 'CONTRACTOR' as const },
      {
        field: 'rateValueMinor',
        oldValue: 10000,
        newValue: 12000,
        auditLogId: 'aud_2',
        resourceType: 'CONTRACT' as const,
      },
    ];
    const out = triggerReasonsSchema.parse(input);
    expect(out).toHaveLength(2);
    expect(out[1]?.resourceType).toBe('CONTRACT');
  });

  it('rejects non-array input', () => {
    expect(() =>
      triggerReasonsSchema.parse({
        field: 'activeTo',
        auditLogId: 'x',
        resourceType: 'CONTRACTOR',
      }),
    ).toThrow();
  });
});
