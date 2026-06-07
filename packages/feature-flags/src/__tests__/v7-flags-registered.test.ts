// Phase 82 · Plan 01 · FOUND7-02 (SC#2) — Wave 0 RED scaffold.
//
// Encodes the "all v7.0 flags registered" contract that Plan 82-03 satisfies.
// RED is the expected Wave 0 state: `V7_FLAG_KEYS` is not exported yet, the 19
// v7.0 keys are not in FLAGS, and none have a signoff-registry entry. 82-03:
//   - adds the 19 dot-namespaced FLAGS entries (D-09),
//   - exports the V7_FLAG_KEYS cohort const (D-10),
//   - adds a PENDING signoff entry per key.
// Do NOT register the flags here.
//
// Also pins the 5th region-lockstep source (SC#3): regionSchema.options must
// hold EU/ME/US — asserted here because regionSchema lives in this package
// (no dependency edge from @contractor-ops/db; see region-lockstep.test.ts).

import { describe, expect, it } from 'vitest';
import { FLAGS, getFlagSignoff, regionSchema, V7_FLAG_KEYS } from '../index';

const DOT_NAMESPACED = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

// The canonical 19-key cohort (82-PATTERNS § flags-core, D-09). Duplicated here
// as the test's source of truth so a drift in V7_FLAG_KEYS is caught, not masked.
const EXPECTED_V7_KEYS = [
  'module.us-expansion',
  'module.workforce-employees',
  'module.public-api',
  'module.outbound-webhooks',
  'module.iris-efile',
  'integration.personio-sync',
  'integration.bamboohr-sync',
  'integration.marketplace-zapier',
  'integration.marketplace-n8n',
  'integration.marketplace-make',
  'payroll.symfonia',
  'payroll.comarch',
  'payroll.enova',
  'payroll.datev',
  'payroll.sage-uk',
  'payroll.gusto',
  'payroll.quickbooks',
  'payroll.adp',
  'payments.ach-payouts',
] as const;

describe('V7_FLAG_KEYS cohort (SC#2)', () => {
  it('exports exactly 19 keys', () => {
    expect(V7_FLAG_KEYS).toHaveLength(19);
  });

  it('matches the canonical 19-key set (D-09)', () => {
    expect(new Set(V7_FLAG_KEYS as readonly string[])).toEqual(new Set(EXPECTED_V7_KEYS));
  });

  it('every key is dot-namespaced (flagDefinitionSchema regex)', () => {
    for (const key of V7_FLAG_KEYS as readonly string[]) {
      expect(key).toMatch(DOT_NAMESPACED);
    }
  });
});

describe('every V7_FLAG_KEYS key is present in FLAGS ∧ the signoff registry (SC#2 all-keys-present)', () => {
  for (const key of EXPECTED_V7_KEYS) {
    it(`'${key}' is defined in FLAGS`, () => {
      expect((FLAGS as Record<string, unknown>)[key]).toBeDefined();
    });

    it(`'${key}' has a signoff-registry entry (getFlagSignoff !== undefined)`, () => {
      expect(getFlagSignoff(key)).not.toBeUndefined();
    });
  }
});

describe('regionSchema lockstep — 5th source includes US (SC#3)', () => {
  it('regionSchema.options holds exactly EU/ME/US', () => {
    expect(new Set(regionSchema.options)).toEqual(new Set(['EU', 'ME', 'US']));
  });
});
