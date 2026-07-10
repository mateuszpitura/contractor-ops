// tax-form.service unit test.
// Owns: pnpm --filter @contractor-ops/api test src/services/__tests__/tax-form.service.test.ts
//
// Exercises the three immutable-record primitives the portal/staff routers wire:
//   - buildFormSnapshot: embeds the ESIGN attestation block (server-derived
//     signedAt/ip/actorId), the captured form fields, and the resolved treaty
//     claim — and NEVER writes a full SSN (last-4 only).
//   - computeExpiry: ~3yr for W-8BEN/W-8BEN-E, no fixed expiry for W-9.
//   - supersedeAndInsert: within a tx, flips the prior ACTIVE row to SUPERSEDED
//     (+ supersededById) and inserts the new ACTIVE row.
//
// The DB-loading supersedeAndInsert is tested against a mocked tx client at the
// taxFormSubmission boundary (no real DB required).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFormSnapshot, computeExpiry, supersedeAndInsert } from '../tax-form.service';

// A synthetic SSN (the historic Woolworth wallet number, not a live identity) —
// asserted to NEVER appear anywhere in a built snapshot.
const FULL_SSN = '078051120';

describe('tax-form.service — buildFormSnapshot (D-05/D-11)', () => {
  it('embeds the ESIGN attestation block with server-derived fields', () => {
    const signedAt = new Date('2026-06-16T12:00:00.000Z');
    const snapshot = buildFormSnapshot({
      formType: 'W9',
      fields: { usEntityType: 'INDIVIDUAL', backupWithholding: false, tin: { ssnLast4: '1120' } },
      attestation: {
        perjuryAccepted: true,
        signerName: 'Jane Q. Contractor',
        signedAt,
        ip: '203.0.113.7',
        actorId: 'contractor-1',
      },
    });

    expect(snapshot.attestation).toEqual({
      perjuryAccepted: true,
      signerName: 'Jane Q. Contractor',
      signedAt: signedAt.toISOString(),
      ip: '203.0.113.7',
      actorId: 'contractor-1',
    });
    expect(snapshot.formType).toBe('W9');
  });

  it('carries the resolved treaty claim for W-8 forms', () => {
    const snapshot = buildFormSnapshot({
      formType: 'W8BEN',
      fields: { treatyCountry: 'PL', ftin: 'PL12345', addressLine1: '1 St', city: 'Warsaw' },
      attestation: {
        perjuryAccepted: true,
        signerName: 'Jan Kowalski',
        signedAt: new Date('2026-06-16T12:00:00.000Z'),
        ip: '203.0.113.8',
        actorId: 'contractor-2',
      },
      treatyClaim: { article: 'Article 7', rate: 0, residency: 'PL' },
    });

    expect(snapshot.treatyClaim).toEqual({ article: 'Article 7', rate: 0, residency: 'PL' });
  });

  it('NEVER writes a full SSN into the snapshot (last-4 only)', () => {
    const snapshot = buildFormSnapshot({
      formType: 'W9',
      // A caller could erroneously pass a full SSN nested in fields — the
      // builder must strip it; only last-4 survives.
      fields: { usEntityType: 'INDIVIDUAL', backupWithholding: false, tin: { ssnLast4: '1120' } },
      attestation: {
        perjuryAccepted: true,
        signerName: 'Jane Q. Contractor',
        signedAt: new Date('2026-06-16T12:00:00.000Z'),
        ip: '203.0.113.7',
        actorId: 'contractor-1',
      },
    });

    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain(FULL_SSN);
    expect(serialised).toContain('1120');
  });

  it('strips any stray full-SSN key a caller leaks into the W-9 tin object', () => {
    const snapshot = buildFormSnapshot({
      formType: 'W9',
      fields: {
        usEntityType: 'INDIVIDUAL',
        backupWithholding: false,
        // Hostile/buggy caller: a full ssn smuggled alongside the last-4.
        tin: { ssnLast4: '1120', ssn: FULL_SSN } as Record<string, unknown>,
      },
      attestation: {
        perjuryAccepted: true,
        signerName: 'Jane Q. Contractor',
        signedAt: new Date('2026-06-16T12:00:00.000Z'),
        ip: '203.0.113.7',
        actorId: 'contractor-1',
      },
    });

    expect(JSON.stringify(snapshot)).not.toContain(FULL_SSN);
  });
});

describe('tax-form.service — computeExpiry (D-05)', () => {
  const signedAt = new Date('2026-06-16T00:00:00.000Z');

  it('returns ~3yr out for W-8BEN', () => {
    const expiry = computeExpiry('W8BEN', signedAt);
    expect(expiry).not.toBeNull();
    expect(expiry?.getUTCFullYear()).toBe(2029);
  });

  it('returns ~3yr out for W-8BEN-E', () => {
    const expiry = computeExpiry('W8BENE', signedAt);
    expect(expiry?.getUTCFullYear()).toBe(2029);
  });

  it('returns null for W-9 (no fixed expiry)', () => {
    expect(computeExpiry('W9', signedAt)).toBeNull();
  });
});

describe('tax-form.service — supersedeAndInsert (D-05, Pitfall 4)', () => {
  type Rec = Record<string, unknown>;
  let updateMany: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let tx: Rec;

  beforeEach(() => {
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    findFirst = vi.fn().mockResolvedValue({ id: 'prior-form-1' });
    update = vi.fn().mockResolvedValue({});
    create = vi.fn().mockResolvedValue({ id: 'new-form-1', status: 'ACTIVE' });
    tx = { taxFormSubmission: { updateMany, findFirst, update, create } };
  });

  it('flips the prior ACTIVE row to SUPERSEDED then inserts the new ACTIVE row', async () => {
    const signedAt = new Date('2026-06-16T12:00:00.000Z');
    const result = await supersedeAndInsert(tx as never, {
      contractorId: 'contractor-1',
      organizationId: 'org-1',
      formType: 'W9',
      snapshot: { formType: 'W9', attestation: { signerName: 'Jane' } } as Rec,
      signerName: 'Jane',
      signedAt,
      expiresAt: null,
    });

    // 1. prior ACTIVE rows for this contractor+formType flipped to SUPERSEDED
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          contractorId: 'contractor-1',
          formType: 'W9',
          status: 'ACTIVE',
        }),
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );

    // 2. new row inserted as ACTIVE
    const createArg = create.mock.calls[0][0] as { data: Rec };
    expect(createArg.data).toMatchObject({
      organizationId: 'org-1',
      contractorId: 'contractor-1',
      formType: 'W9',
      status: 'ACTIVE',
    });

    expect(result.id).toBe('new-form-1');

    expect(findFirst).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'prior-form-1' },
      data: { supersededById: 'new-form-1' },
    });
  });

  it('supersede runs before the insert (ordering)', async () => {
    const order: string[] = [];
    updateMany.mockImplementation(async () => {
      order.push('supersede');
      return { count: 1 };
    });
    create.mockImplementation(async () => {
      order.push('insert');
      return { id: 'x', status: 'ACTIVE' };
    });
    findFirst.mockResolvedValue(null);

    await supersedeAndInsert(tx as never, {
      contractorId: 'c',
      organizationId: 'o',
      formType: 'W8BEN',
      snapshot: {} as Rec,
      signerName: 'X',
      signedAt: new Date(),
      expiresAt: new Date(),
      treatyArticle: 'Article 7',
      treatyRate: 0,
      contractorResidency: 'PL',
    });

    expect(order).toEqual(['supersede', 'insert']);
  });
});
