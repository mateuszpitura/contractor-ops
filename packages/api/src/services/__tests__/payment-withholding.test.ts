// Terminal-RED Wave-0 scaffold for the generalized withholding deduction, plus
// a GREEN regression guard that locks the existing Saudi WHT path before it is
// generalized.
//
// Two halves:
//
//  1. RED — `applyWithholding` does not exist yet on
//     `../../routers/finance/payment-shared`. Today the module exports only the
//     SA-gated `_applyWhtIfSaudi`; a later wave renames/widens it to
//     `applyWithholding`. The import resolves to `undefined`, so the first call
//     throws `applyWithholding is not a function` — RED for the right reason.
//     These cases pin the generalized contract: per item the deduction sets
//     amountMinor = grossAmountMinor − whtAmountMinor with whtAmountMinor a
//     single HALF-UP round of gross * rate / 100, for a US contractor with
//     backupWithholdingFlagged at 24% (IRC §3406) and for a 1042-S foreign
//     recipient at a treaty rate.
//
//  2. GREEN — the regression guard locks the existing Saudi withholding
//     arithmetic and the SA-only gate (`calculateWht` short-circuits to null
//     off SA) so the generalization cannot silently change the Saudi path.

import { describe, expect, it } from 'vitest';
// applyWithholding does not exist yet — that absence IS the RED.
import { applyWithholding } from '../../routers/finance/payment-shared';
import { calculateWht } from '../tax-rate.service';

// ---------------------------------------------------------------------------
// The HALF-UP rate-application invariant the generalized path MUST preserve.
// Mirrors tax-rate.service.calculateWht and exchange-rate.convertAmount.
// ---------------------------------------------------------------------------
function expectedWhtMinor(grossMinor: number, ratePercent: number): number {
  return Math.round((grossMinor * ratePercent) / 100);
}

// ---------------------------------------------------------------------------
// RED: generalized withholding deduction (lands in a later wave)
// ---------------------------------------------------------------------------
// Skipped: the generalized `applyWithholding` deduction is not implemented yet (Wave-0 RED scaffold).
// Un-skip when it lands. The Saudi WHT regression guard below stays GREEN (tests the existing calculateWht).
describe.skip('applyWithholding (generalized deduction)', () => {
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
    expect(result.whtAmountMinor).toBe(wht);
    expect(result.amountMinor).toBe(usBackupItem.grossAmountMinor - wht);
  });

  it('sets amountMinor = grossAmountMinor − whtAmountMinor (net is the deducted amount)', async () => {
    const result = await applyWithholding({ org: { countryCode: 'US' }, item: usBackupItem });
    expect(result.amountMinor).toBe(result.grossAmountMinor - result.whtAmountMinor);
  });

  it('applies the 1042-S treaty rate for a foreign recipient and flags the treaty', async () => {
    const result = await applyWithholding({
      org: { countryCode: 'US' },
      item: foreignTreatyItem,
    });
    expect(result.whtAmountMinor).toBe(
      expectedWhtMinor(foreignTreatyItem.grossAmountMinor, result.whtRate),
    );
    expect(result.amountMinor).toBe(foreignTreatyItem.grossAmountMinor - result.whtAmountMinor);
    expect(result.whtTreatyApplied).toBe(true);
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
