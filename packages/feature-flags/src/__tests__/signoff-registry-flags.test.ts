// Phase 70-01 · FOUND6-04 — failing test scaffold for the flag-namespace
// signoff registry Zod schema. Plan 70-05 implements
// `signoff-registry-flags-schema.ts`.

import { describe, expect, it } from 'vitest';
import { FlagSignoffEntrySchema } from '../signoff-registry-flags-schema';

describe('FlagSignoffEntrySchema (FOUND6-04)', () => {
  it('accepts a minimal PENDING entry', () => {
    const result = FlagSignoffEntrySchema.safeParse({ status: 'PENDING' });
    expect(result.success).toBe(true);
  });

  it('accepts an APPROVED entry with all required fields including legalTicketRef LEGAL-123', () => {
    const result = FlagSignoffEntrySchema.safeParse({
      status: 'APPROVED',
      approvedBy: 'jane@contractor-ops.local',
      approvedAt: '2026-04-26T00:00:00.000Z',
      approverRole: 'LEGAL_LEAD',
      legalTicketRef: 'LEGAL-123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a URL legalTicketRef', () => {
    const result = FlagSignoffEntrySchema.safeParse({
      status: 'APPROVED',
      approvedBy: 'jane@x',
      approvedAt: '2026-04-26T00:00:00.000Z',
      approverRole: 'LEGAL_LEAD',
      legalTicketRef: 'https://issues.local/legal/123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects APPROVED entry missing legalTicketRef', () => {
    const result = FlagSignoffEntrySchema.safeParse({
      status: 'APPROVED',
      approvedBy: 'jane',
      approvedAt: '2026-04-26T00:00:00.000Z',
      approverRole: 'LEGAL_LEAD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed legalTicketRef', () => {
    const result = FlagSignoffEntrySchema.safeParse({
      status: 'APPROVED',
      approvedBy: 'jane',
      approvedAt: '2026-04-26T00:00:00.000Z',
      approverRole: 'LEGAL_LEAD',
      legalTicketRef: 'TICKET-XYZ',
    });
    expect(result.success).toBe(false);
  });
});
