// treaty-rate.service unit test.
// Owns: pnpm --filter @contractor-ops/api test src/services/__tests__/treaty-rate.service.test.ts
//
// Mirrors the reverse-charge.service test discipline: the pure decision
// function (`resolveTreatyDecision`) is exercised directly with no I/O, and the
// DB-loading `applyTreaty` is tested against a mocked Prisma client at the
// `withholdingTaxRate.findFirst` boundary (no real DB / seed required).
//
// What we assert:
//   - resolveTreatyDecision: treaty branch, 30% statutory branch, override
//     branch (with required reason), and override-without-reason rejection.
//   - applyTreaty: PL resolves to rate 0 / Article 7; an XX-only residency
//     falls back to the 30% statutory default; a specific residency beats XX;
//     the lookup carries sourceCountry='US' + serviceType='business_profits'.

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => {
  const prisma = {
    withholdingTaxRate: { findFirst: vi.fn() },
  };
  return {
    prisma,
    prismaRaw: prisma,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
  };
});

import { prisma } from '@contractor-ops/db';
import { applyTreaty, resolveTreatyDecision } from '../treaty-rate.service';

const mockWht = vi.mocked(prisma.withholdingTaxRate);

describe('treaty-rate.service — resolveTreatyDecision (US-LOC-02/03, D-10)', () => {
  it('no override + a matched treaty row returns the treaty rate/article with source="treaty"', () => {
    const decision = resolveTreatyDecision({
      autoRate: 0,
      autoArticle: 'Article 7',
      hasTreatyRow: true,
    });

    expect(decision).toEqual({
      rate: 0,
      article: 'Article 7',
      source: 'treaty',
      autoDetected: true,
      auditRequired: false,
      autoRate: 0,
      autoArticle: 'Article 7',
    });
  });

  it('no treaty row falls back to the 30% statutory default with source="statutory_30"', () => {
    const decision = resolveTreatyDecision({
      autoRate: null,
      autoArticle: null,
      hasTreatyRow: false,
    });

    expect(decision).toEqual({
      rate: 30,
      article: null,
      source: 'statutory_30',
      autoDetected: false,
      auditRequired: false,
      autoRate: null,
      autoArticle: null,
    });
  });

  it('an override rate + a non-empty reason wins with source="override" and preserves the auto-detected value', () => {
    const decision = resolveTreatyDecision({
      autoRate: 0,
      autoArticle: 'Article 7',
      hasTreatyRow: true,
      overrideRate: 15,
      overrideArticle: 'Article 12',
      overrideReason: 'Royalty income reclassified per adviser review',
    });

    expect(decision.source).toBe('override');
    expect(decision.rate).toBe(15);
    expect(decision.article).toBe('Article 12');
    expect(decision.auditRequired).toBe(true);
    // The auto-detected value is preserved alongside for the audit trail.
    expect(decision.autoRate).toBe(0);
    expect(decision.autoArticle).toBe('Article 7');
    expect(decision.autoDetected).toBe(true);
  });

  it('an override without a reason is rejected with a structured BAD_REQUEST (reason is required, D-10)', () => {
    const expectBadRequest = (fn: () => unknown) => {
      expect(fn).toThrow(TRPCError);
      try {
        fn();
      } catch (err) {
        expect((err as TRPCError).code).toBe('BAD_REQUEST');
        expect((err as TRPCError).message).toBe('treatyOverrideReasonRequired');
      }
    };

    expectBadRequest(() =>
      resolveTreatyDecision({
        autoRate: 0,
        autoArticle: 'Article 7',
        hasTreatyRow: true,
        overrideRate: 15,
      }),
    );

    expectBadRequest(() =>
      resolveTreatyDecision({
        autoRate: 0,
        autoArticle: 'Article 7',
        hasTreatyRow: true,
        overrideRate: 15,
        overrideReason: '   ',
      }),
    );
  });

  it('a reason without any override value does NOT switch to the override branch', () => {
    const decision = resolveTreatyDecision({
      autoRate: 0,
      autoArticle: 'Article 7',
      hasTreatyRow: true,
      overrideReason: 'noted but no value supplied',
    });

    expect(decision.source).toBe('treaty');
    expect(decision.rate).toBe(0);
    expect(decision.auditRequired).toBe(false);
  });
});

describe('treaty-rate.service — applyTreaty (US-LOC-02/03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PL resolves to rate 0 / Article 7 via the US business-profits treaty row', async () => {
    // First query (specific residency) returns the PL row, so the XX fallback
    // query is never reached.
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'PL',
      standardRate: 30,
      treatyRate: 0,
      treatyArticle: 'Article 7',
    } as never);

    const decision = await applyTreaty({ contractorResidency: 'PL' });

    expect(decision.source).toBe('treaty');
    expect(decision.rate).toBe(0);
    expect(decision.article).toBe('Article 7');

    // The lookup is keyed on US source + business_profits income axis, querying
    // the exact residency first (no lexicographic orderBy on the fallback).
    const args = mockWht.findFirst.mock.calls[0]?.[0];
    expect(args?.where?.sourceCountry).toBe('US');
    expect(args?.where?.serviceType).toBe('business_profits');
    expect(args?.where?.contractorResidency).toBe('PL');
    expect(args?.orderBy).toBeUndefined();
    // The PL row matched, so the XX fallback query is skipped.
    expect(mockWht.findFirst).toHaveBeenCalledTimes(1);
  });

  it('a residency that only matches the XX fallback row resolves to the 30% statutory default', async () => {
    // Specific 'AE' row absent → fall back to the XX row (treatyRate=null → statutory).
    mockWht.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      contractorResidency: 'XX',
      standardRate: 30,
      treatyRate: null,
      treatyArticle: null,
    } as never);

    const decision = await applyTreaty({ contractorResidency: 'AE' });

    expect(decision.source).toBe('statutory_30');
    expect(decision.rate).toBe(30);
    expect(decision.article).toBeNull();
    // First query targets the specific residency, second the XX fallback.
    expect(mockWht.findFirst.mock.calls[0]?.[0]?.where?.contractorResidency).toBe('AE');
    expect(mockWht.findFirst.mock.calls[1]?.[0]?.where?.contractorResidency).toBe('XX');
  });

  it('no row at all (neither specific nor XX) resolves to the 30% statutory default', async () => {
    mockWht.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const decision = await applyTreaty({ contractorResidency: 'ZZ' });

    expect(decision.source).toBe('statutory_30');
    expect(decision.rate).toBe(30);
  });

  it('a specific residency row beats the XX fallback (two-query lookup, specific first)', async () => {
    // The specific-residency query returns the 'DE' row, so XX is never queried.
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'DE',
      standardRate: 30,
      treatyRate: 0,
      treatyArticle: 'Article 7',
    } as never);

    const decision = await applyTreaty({ contractorResidency: 'DE' });

    expect(decision.rate).toBe(0);
    expect(decision.article).toBe('Article 7');
    expect(decision.source).toBe('treaty');
    expect(mockWht.findFirst).toHaveBeenCalledTimes(1);
  });

  it('a residency that sorts after XX (e.g. ZW) still prefers its specific treaty row over the XX fallback', async () => {
    // Regression guard: a lexicographic orderBy would have returned the 'XX'
    // fallback ahead of 'ZW' (which sorts after 'XX'), dropping the real treaty.
    // The two-query lookup queries 'ZW' first and never reaches XX.
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'ZW',
      standardRate: 30,
      treatyRate: 5,
      treatyArticle: 'Article 7',
    } as never);

    const decision = await applyTreaty({ contractorResidency: 'ZW' });

    expect(decision.source).toBe('treaty');
    expect(decision.rate).toBe(5);
    expect(decision.article).toBe('Article 7');
    expect(mockWht.findFirst.mock.calls[0]?.[0]?.where?.contractorResidency).toBe('ZW');
    expect(mockWht.findFirst).toHaveBeenCalledTimes(1);
  });

  it('an override with a reason wins over the auto-detected treaty rate', async () => {
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'PL',
      standardRate: 30,
      treatyRate: 0,
      treatyArticle: 'Article 7',
    } as never);

    const decision = await applyTreaty({
      contractorResidency: 'PL',
      override: { rate: 10, article: 'Article 5', reason: 'PE established in the US' },
    });

    expect(decision.source).toBe('override');
    expect(decision.rate).toBe(10);
    expect(decision.article).toBe('Article 5');
    expect(decision.auditRequired).toBe(true);
    expect(decision.autoRate).toBe(0);
    expect(decision.autoArticle).toBe('Article 7');
  });
});
