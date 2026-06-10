// COMPL doc-name parity guard.
//
// Asserts:
//   1. Every policyRuleId in @contractor-ops/compliance-policy registry has a
//      matching entry in the relevant LOCKED_COMPL_NAMES_<JX> const.
//   2. Every entry has en + pl + de + ar keys (ar REQUIRED per 2026-05-31 re-plan:
//      the i18n:parity guard peers en against [de, pl, ar]).
//   3. Every policyRuleId has a corresponding COMPL_DOCNAME_* signoff entry.

import type { Jurisdiction } from '@contractor-ops/compliance-policy';
import { listPolicyRules } from '@contractor-ops/compliance-policy';
import { describe, expect, it } from 'vitest';
import { LOCKED_COMPL_NAMES_DE } from '../legal/compliance-de.js';
import { LOCKED_COMPL_NAMES_KSA } from '../legal/compliance-ksa.js';
import { LOCKED_COMPL_NAMES_PL } from '../legal/compliance-pl.js';
import { LOCKED_COMPL_NAMES_UAE } from '../legal/compliance-uae.js';
import { LOCKED_COMPL_NAMES_UK } from '../legal/compliance-uk.js';
import { LOCKED_COMPL_NAMES_US } from '../legal/compliance-us.js';
import rawRegistry from '../legal/signoff-registry.json' with { type: 'json' };

type LocalePhraseMap = { en: string; pl: string; de: string; ar: string };

const REGISTRIES_BY_JURISDICTION = {
  UK: LOCKED_COMPL_NAMES_UK,
  DE: LOCKED_COMPL_NAMES_DE,
  PL: LOCKED_COMPL_NAMES_PL,
  KSA: LOCKED_COMPL_NAMES_KSA,
  UAE: LOCKED_COMPL_NAMES_UAE,
  US: LOCKED_COMPL_NAMES_US,
} satisfies Record<Jurisdiction, Record<string, LocalePhraseMap>>;

function flatKey(policyRuleId: string): string {
  return `COMPL_DOCNAME_${policyRuleId.replace(/\./g, '_').replace(/@v/g, '_v')}`;
}

const ALL_RULES = listPolicyRules();
const ALL_ENTRIES = Object.values(REGISTRIES_BY_JURISDICTION).flatMap(reg =>
  Object.entries(reg).map(([key, value]) => ({ key, value: value as LocalePhraseMap })),
);

describe('compl-doc-names-parity policyRuleId', () => {
  it('every policyRuleId in @contractor-ops/compliance-policy registry has a matching locked-name entry', () => {
    expect(
      ALL_RULES.length,
      'registry must be populated for a meaningful parity check',
    ).toBeGreaterThan(0);
    for (const rule of ALL_RULES) {
      const registry = REGISTRIES_BY_JURISDICTION[rule.jurisdiction];
      expect(
        registry,
        `No locked-name registry for jurisdiction ${rule.jurisdiction} — add packages/validators/src/legal/compliance-${rule.jurisdiction.toLowerCase()}.ts`,
      ).toBeDefined();
      expect(
        (registry as Record<string, unknown>)[rule.policyRuleId],
        `Missing locked-name entry for ${rule.policyRuleId} (jurisdiction ${rule.jurisdiction}) — add it to compliance-${rule.jurisdiction.toLowerCase()}.ts`,
      ).toBeDefined();
    }
  });
});

describe('compl-doc-names-parity en+pl+de+ar', () => {
  it.each(
    ALL_ENTRIES.map(e => [e.key]),
  )('entry %s has non-empty en + pl + de + ar keys (ar required for i18n:parity)', key => {
    const entry = ALL_ENTRIES.find(e => e.key === key)?.value as LocalePhraseMap;
    expect(entry.en, `${key} missing en`).toBeTruthy();
    expect(entry.pl, `${key} missing pl`).toBeTruthy();
    expect(entry.de, `${key} missing de`).toBeTruthy();
    expect(entry.ar, `${key} missing ar`).toBeTruthy();
  });
});

describe('compl-doc-names-parity per-jurisdiction-coverage', () => {
  it('enumerates at least one policyRuleId per EU/UK/Gulf jurisdiction', () => {
    const seen = new Set(ALL_RULES.map(r => r.jurisdiction));
    for (const jx of ['UK', 'DE', 'PL', 'KSA', 'UAE'] as const) {
      expect(seen.has(jx), `no registered policyRuleId for ${jx}`).toBe(true);
    }
  });
});

describe('compl-doc-names-parity signoff', () => {
  it('every policyRuleId has a corresponding COMPL_DOCNAME_* PENDING/APPROVED entry in signoff-registry.json', () => {
    const registry = rawRegistry as Record<string, { status: string }>;
    expect(ALL_RULES.length).toBeGreaterThan(0);
    for (const rule of ALL_RULES) {
      const key = flatKey(rule.policyRuleId);
      const entry = registry[key];
      expect(
        entry,
        `Missing signoff entry for ${key} — add to signoff-registry.json`,
      ).toBeDefined();
      expect(['PENDING', 'APPROVED']).toContain(entry?.status);
    }
  });
});
