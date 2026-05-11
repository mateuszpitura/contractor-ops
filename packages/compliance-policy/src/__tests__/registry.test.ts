import { describe, expect, it } from 'vitest';
import { listPolicyRules } from '../registry';
import '../index'; // triggers module-import side effects (Plan 71-02 registers rules on import)

describe('compliance-policy registry', () => {
  it('registers all 13 baseline policy rules across 5 jurisdictions', () => {
    const rules = listPolicyRules();
    expect(rules.length).toBe(13); // Will fail until Plan 71-02 ships rules
  });

  it('every policyRuleId matches the stable-namespace@vN regex', () => {
    const rules = listPolicyRules();
    // Matches Plan 71-02 POLICY_RULE_ID_RE (permits digits in doc namespace, e.g. `de.a1`).
    const re = /^[a-z]+\.[a-z][a-z_0-9]*@v\d+$/;
    for (const r of rules) {
      expect(re.test(r.policyRuleId), `bad id: ${r.policyRuleId}`).toBe(true);
    }
  });

  it('no duplicate policyRuleId values', () => {
    const rules = listPolicyRules();
    const ids = rules.map(r => r.policyRuleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule references a non-empty documentType', () => {
    const rules = listPolicyRules();
    for (const r of rules) {
      expect(r.documentType.length).toBeGreaterThan(0);
    }
  });

  it('every rule has expiryJurisdictionTz as a valid IANA-shaped string', () => {
    const rules = listPolicyRules();
    for (const r of rules) {
      expect(r.expiryJurisdictionTz).toMatch(/^[A-Za-z]+\/[A-Za-z_]+$/);
    }
  });
});
