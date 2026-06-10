// packages/einvoice/src/profiles/xrechnung-de/__tests__/locked-phrase-parity.test.ts
//
// Drift guard for locked legal phrases.
//
// The XRechnung generator emits ExemptionReason strings that MUST byte-match
// the locked legal phrases (Steuerschuldnerschaft des Leistungsempfängers /
// §19 UStG Kleinunternehmer-Hinweis). KoSIT Business Rules BR-DE-10 /
// BR-DE-14 require the exact canonical wording.
//
// The einvoice package cannot relative-import from `packages/validators/src`
// without violating its own `rootDir` TS boundary, and cannot depend on
// `@contractor-ops/validators` at the package level (cyclic: validators
// already depends on einvoice for zatca re-exports). We therefore keep a
// MIRROR of the two constants in `xrechnung-de/constants.ts` and use this
// test — run under vitest's unrestricted import semantics — to assert that
// the mirror never drifts from the canonical source.
//
// If the canonical phrase ever changes, this test fails and the
// xrechnung-de mirror must be updated in lockstep.

import { describe, expect, it } from 'vitest';
import {
  XRECHNUNG_KLEINUNTERNEHMER_REASON,
  XRECHNUNG_REVERSE_CHARGE_REASON,
  XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE,
} from '../constants.js';

// The canonical source is `packages/validators/src/legal/de.ts`. We cannot
// static-import across package boundaries here without violating einvoice's
// tsconfig `rootDir`. We instead use a dynamic runtime import (resolved by
// vitest's module graph, which has no rootDir constraint) — if the file ever
// moves or changes, the test fails loudly.
async function loadCanonical(): Promise<{
  TAX_STEUERSCHULDNERSCHAFT: string;
  TAX_KLEINUNTERNEHMER_NOTICE: string;
  SKONTO_DESCRIPTION_TEMPLATE_DE: string;
}> {
  // @ts-expect-error — cross-package source path, intentional for parity check
  const mod = (await import('../../../../../validators/src/legal/de.ts')) as {
    TAX_STEUERSCHULDNERSCHAFT: string;
    TAX_KLEINUNTERNEHMER_NOTICE: string;
    SKONTO_DESCRIPTION_TEMPLATE_DE: string;
  };
  return mod;
}

describe('XRechnung locked-phrase parity with @contractor-ops/validators (Phase 56)', () => {
  it('XRECHNUNG_REVERSE_CHARGE_REASON mirrors TAX_STEUERSCHULDNERSCHAFT (§13b UStG)', async () => {
    const { TAX_STEUERSCHULDNERSCHAFT } = await loadCanonical();
    expect(XRECHNUNG_REVERSE_CHARGE_REASON).toBe(TAX_STEUERSCHULDNERSCHAFT);
  });

  it('XRECHNUNG_KLEINUNTERNEHMER_REASON mirrors TAX_KLEINUNTERNEHMER_NOTICE (§19 UStG)', async () => {
    const { TAX_KLEINUNTERNEHMER_NOTICE } = await loadCanonical();
    expect(XRECHNUNG_KLEINUNTERNEHMER_REASON).toBe(TAX_KLEINUNTERNEHMER_NOTICE);
  });

  it('XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE mirrors SKONTO_DESCRIPTION_TEMPLATE_DE (Phase 63 D-22)', async () => {
    const { SKONTO_DESCRIPTION_TEMPLATE_DE } = await loadCanonical();
    expect(XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE).toBe(SKONTO_DESCRIPTION_TEMPLATE_DE);
  });
});
