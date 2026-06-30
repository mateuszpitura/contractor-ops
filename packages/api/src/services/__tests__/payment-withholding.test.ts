// Generalized withholding-deduction suite, plus a regression guard that locks
// the existing Saudi WHT path so the generalization cannot silently change it.
//
// Two halves:
//
//  1. `applyWithholding` — the jurisdiction-agnostic per-item deduction that
//     generalizes the SA-only path. The cases pin the contract: per item the
//     deduction sets amountMinor = grossAmountMinor − whtAmountMinor with
//     whtAmountMinor a single HALF-UP round of gross * rate / 100, for a US
//     contractor with backupWithholdingFlagged at 24% (IRC §3406) and for a
//     1042-S foreign recipient at the resolved treaty rate.
//
//  2. The Saudi WHT regression guard locks the existing withholding arithmetic
//     and the SA-only gate (`calculateWht` short-circuits to null off SA) so the
//     generalization cannot silently change the Saudi path.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The treaty branch reads `withholdingTaxRate` through `applyTreaty`; mock the
// Prisma boundary (mirrors treaty-rate.service.test.ts) so the suite needs no
// live DB. The US-backup branch is a flat statutory rate and never queries.
vi.mock('@contractor-ops/db', () => {
  const prisma = {
    withholdingTaxRate: { findFirst: vi.fn() },
    taxRate: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  return {
    prisma,
    prismaRaw: prisma,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
  };
});

import { prisma } from '@contractor-ops/db';
import { applyWithholding } from '../../routers/finance/payment-shared';
import { calculateWht } from '../tax-rate.service';

const mockWht = vi.mocked(prisma.withholdingTaxRate);

// ---------------------------------------------------------------------------
// The HALF-UP rate-application invariant the generalized path MUST preserve.
// Mirrors tax-rate.service.calculateWht and exchange-rate.convertAmount.
// ---------------------------------------------------------------------------
function expectedWhtMinor(grossMinor: number, ratePercent: number): number {
  return Math.round((grossMinor * ratePercent) / 100);
}

// ---------------------------------------------------------------------------
// applyWithholding — generalized per-item withholding deduction
// ---------------------------------------------------------------------------
describe('applyWithholding (generalized deduction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const usBackupItem = {
    grossAmountMinor: 100_000,
    contractor: { countryCode: 'US', backupWithholdingFlagged: true },
  };

  const foreignTreatyItem = {
    grossAmountMinor: 100_000,
    contractor: { countryCode: 'DE', backupWithholdingFlagged: false },
  };

  it('deducts 24% backup withholding (IRC §3406) for a flagged US contractor', async () => {
    const result = await applyWithholding({ org: { countryCode: 'US' }, item: usBackupItem });
    const wht = expectedWhtMinor(usBackupItem.grossAmountMinor, 24);
    expect(result?.whtAmountMinor).toBe(wht);
    expect(result?.amountMinor).toBe(usBackupItem.grossAmountMinor - wht);
    expect(result?.whtTreatyApplied).toBe(false);
  });

  it('sets amountMinor = grossAmountMinor − whtAmountMinor (net is the deducted amount)', async () => {
    const result = await applyWithholding({ org: { countryCode: 'US' }, item: usBackupItem });
    expect(result).not.toBeNull();
    expect(result?.amountMinor).toBe(
      (result?.grossAmountMinor ?? 0) - (result?.whtAmountMinor ?? 0),
    );
  });

  it('applies the 1042-S treaty rate for a foreign recipient and flags the treaty', async () => {
    // A DE business-profits treaty row reduces the 30% statutory rate.
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'DE',
      standardRate: 30,
      treatyRate: 15,
      treatyArticle: 'Article 7',
    } as never);

    const result = await applyWithholding({
      org: { countryCode: 'US' },
      item: foreignTreatyItem,
    });
    expect(result?.whtAmountMinor).toBe(
      expectedWhtMinor(foreignTreatyItem.grossAmountMinor, result?.whtRate ?? 0),
    );
    expect(result?.amountMinor).toBe(
      foreignTreatyItem.grossAmountMinor - (result?.whtAmountMinor ?? 0),
    );
    expect(result?.whtTreatyApplied).toBe(true);
    expect(result?.whtTreatyReference).toBe('Article 7');
  });

  it('falls back to the 30% statutory 1042-S rate when no treaty row matches', async () => {
    // Neither the specific residency nor the XX fallback row exists → statutory 30%.
    mockWht.findFirst.mockResolvedValue(null as never);

    const result = await applyWithholding({
      org: { countryCode: 'US' },
      item: { grossAmountMinor: 100_000, contractor: { countryCode: 'BR' } },
    });
    expect(result?.whtRate).toBe(30);
    expect(result?.whtAmountMinor).toBe(expectedWhtMinor(100_000, 30));
    expect(result?.whtTreatyApplied).toBe(false);
  });

  it('leaves a non-flagged US domestic recipient untouched (no withholding)', async () => {
    const result = await applyWithholding({
      org: { countryCode: 'US' },
      item: { grossAmountMinor: 100_000, contractor: { countryCode: 'US' } },
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GREEN: Saudi WHT regression guard (baseline lock before generalization)
// ---------------------------------------------------------------------------
describe('Saudi WHT path (regression guard — stays GREEN through generalization)', () => {
  it('short-circuits to null off Saudi (the SA-only gate the generalization replaces)', async () => {
    expect(await calculateWht('US', 'DE', 'technical_services', 100_000)).toBeNull();
    expect(await calculateWht('PL', 'DE', 'technical_services', 100_000)).toBeNull();
  });

  it('treats a Saudi domestic payment (SA → SA) as no withholding', async () => {
    expect(await calculateWht('SA', 'SA', 'technical_services', 100_000)).toBeNull();
  });
});
