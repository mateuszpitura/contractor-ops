// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-11 locked-phrase registry parity guard (D-17);
// new modules live in packages/validators/src/legal/compliance-{jurisdiction}.ts (Plan 73-04).

import { describe, expect, it } from 'vitest';

describe('compl-doc-names-parity policyRuleId', () => {
  it('every policyRuleId in @contractor-ops/compliance-policy registry has a matching locked-name entry', async () => {
    const policyMod = await import('@contractor-ops/compliance-policy');
    const ukMod = await import('../legal/compliance-uk.js');
    expect(ukMod.LOCKED_COMPL_NAMES_UK).toBeDefined();

    const rules = policyMod.listPolicyRules();
    for (const rule of rules) {
      if (rule.jurisdiction === 'UK') {
        // @ts-expect-error — registry shape created in Plan 73-04
        expect(
          ukMod.LOCKED_COMPL_NAMES_UK[rule.policyRuleId],
          `Missing UK entry for ${rule.policyRuleId}`,
        ).toBeDefined();
      }
    }
    throw new Error('compliance-uk.ts module not yet implemented');
  });
});

describe('compl-doc-names-parity en+pl+de', () => {
  it('every locked-name entry has en + pl + de keys (Arabic = Phase 79)', async () => {
    throw new Error('en/pl/de parity check not yet implemented');
  });
});

describe('compl-doc-names-parity signoff', () => {
  it('every policyRuleId has a corresponding COMPL_DOCNAME_* PENDING entry in signoff-registry.json', async () => {
    throw new Error('signoff parity check not yet implemented');
  });
});
