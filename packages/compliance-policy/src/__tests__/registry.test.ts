import { describe, expect, it } from 'vitest';
import { listPolicyRules, resolvePolicyRules } from '../registry';
import type { EngagementContext, Jurisdiction } from '../types';
import '../index'; // triggers module-import side effects (registers all jurisdiction rules)

// 6 IP-assignment rules (1 per jurisdiction, incl. US module) on top of the
// 13 baseline rules.
const PHASE_71_BASELINE_RULE_COUNT = 13;
const PHASE_75_IP_RULE_COUNT = 6;

function ctx(jurisdiction: Jurisdiction): EngagementContext {
  return {
    jurisdiction,
    outcome: 'IR35-OUTSIDE',
    sector: null,
    contractorNationality: null,
    requiresRegulatedEquipment: false,
  };
}

describe('compliance-policy registry', () => {
  it('registers all baseline + IP-assignment rules across 6 jurisdictions', () => {
    const rules = listPolicyRules();
    expect(rules.length).toBe(PHASE_71_BASELINE_RULE_COUNT + PHASE_75_IP_RULE_COUNT);
  });

  it('every policyRuleId matches the stable-namespace@vN regex', () => {
    const rules = listPolicyRules();
    // Matches POLICY_RULE_ID_RE (permits digits in doc namespace, e.g. `de.a1`).
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

describe('IP-assignment policy rules', () => {
  const phase75Rules = [
    { id: 'uk.ip_assignment@v1', jurisdiction: 'UK' as const, tz: 'Europe/London' },
    { id: 'de.werkvertrag_ip@v1', jurisdiction: 'DE' as const, tz: 'Europe/Berlin' },
    { id: 'pl.ip_assignment@v1', jurisdiction: 'PL' as const, tz: 'Europe/Warsaw' },
    { id: 'us.ip_assignment@v1', jurisdiction: 'US' as const, tz: 'America/New_York' },
    { id: 'ksa.ip_assignment@v1', jurisdiction: 'KSA' as const, tz: 'Asia/Riyadh' },
    { id: 'uae.ip_assignment@v1', jurisdiction: 'UAE' as const, tz: 'Asia/Dubai' },
  ];

  for (const rule of phase75Rules) {
    it(`registers ${rule.id} as severity WARNING with documentType IP_RATIFICATION`, () => {
      const target = resolvePolicyRules(ctx(rule.jurisdiction)).find(
        r => r.policyRuleId === rule.id,
      );
      expect(target).toBeDefined();
      expect(target?.severity).toBe('WARNING');
      expect(target?.documentType).toBe('IP_RATIFICATION');
      expect(target?.expiryJurisdictionTz).toBe(rule.tz);
    });
  }

  it('all 6 IP-assignment rules carry the PENDING legal review marker in draftLegalText', () => {
    for (const rule of phase75Rules) {
      const target = resolvePolicyRules(ctx(rule.jurisdiction)).find(
        r => r.policyRuleId === rule.id,
      );
      expect(target?.draftLegalText).toMatch(/PENDING legal review/);
    }
  });

  it('the DE rule cites both §31 UrhG and §7 UrhG (Schöpferprinzip)', () => {
    const de = resolvePolicyRules(ctx('DE')).find(r => r.policyRuleId === 'de.werkvertrag_ip@v1');
    expect(de?.draftLegalText).toMatch(/§31/);
    expect(de?.draftLegalText).toMatch(/§7/);
    expect(de?.draftLegalText).toMatch(/Sch[öo]pferprinzip/);
    expect(de?.draftLegalText).toMatch(/INSUFFICIENT/);
  });
});
