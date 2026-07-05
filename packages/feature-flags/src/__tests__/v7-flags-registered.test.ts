// Verifies the "all v7.0 flags registered" contract: every key in V7_FLAG_KEYS
// must be present in FLAGS and have a signoff-registry entry.
//
// Also pins the region-lockstep invariant: regionSchema.options must hold
// EU/ME/US — asserted here because regionSchema lives in this package
// (no dependency edge from @contractor-ops/db; see region-lockstep.test.ts).

import { describe, expect, it } from 'vitest';
import { FLAGS, getFlagSignoff, regionSchema, V7_FLAG_KEYS } from '../index';

const DOT_NAMESPACED = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

// The canonical 20-key cohort. Duplicated here as the test's source of truth
// so a drift in V7_FLAG_KEYS is caught, not masked.
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
  'payroll.sage-de',
  'payroll.sage-uk',
  'payroll.gusto',
  'payroll.quickbooks',
  'payroll.adp',
  'payments.ach-payouts',
] as const;

describe('V7_FLAG_KEYS cohort', () => {
  it('exports exactly 20 keys', () => {
    expect(V7_FLAG_KEYS).toHaveLength(20);
  });

  it('matches the canonical 20-key set', () => {
    expect(new Set(V7_FLAG_KEYS as readonly string[])).toEqual(new Set(EXPECTED_V7_KEYS));
  });

  it('every key is dot-namespaced (flagDefinitionSchema regex)', () => {
    for (const key of V7_FLAG_KEYS as readonly string[]) {
      expect(key).toMatch(DOT_NAMESPACED);
    }
  });
});

describe('every V7_FLAG_KEYS key is present in FLAGS and the signoff registry', () => {
  for (const key of EXPECTED_V7_KEYS) {
    it(`'${key}' is defined in FLAGS`, () => {
      expect((FLAGS as Record<string, unknown>)[key]).toBeDefined();
    });

    it(`'${key}' has a signoff-registry entry (getFlagSignoff !== undefined)`, () => {
      expect(getFlagSignoff(key)).not.toBeUndefined();
    });
  }
});

describe('regionSchema lockstep — includes US', () => {
  it('regionSchema.options holds exactly EU/ME/US', () => {
    expect(new Set(regionSchema.options)).toEqual(new Set(['EU', 'ME', 'US']));
  });
});
