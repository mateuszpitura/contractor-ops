import { describe, expect, it } from 'vitest';
import '../index.js';
import { resolvePolicyRules } from '../registry.js';
import type { EngagementContext } from '../types.js';

describe('resolvePolicyRules — ROADMAP success criteria fixtures', () => {
  it('UK B2B classified IR35-INSIDE materialises 4 rows (RTW + UTR + business-registration + SDS)', () => {
    const ctx: EngagementContext = {
      jurisdiction: 'UK',
      outcome: 'IR35-INSIDE',
      sector: null,
      contractorNationality: 'GB',
      requiresRegulatedEquipment: false,
    };
    const rules = resolvePolicyRules(ctx);
    const ids = rules.map(r => r.policyRuleId).sort();
    expect(ids).toEqual([
      'uk.business_registration@v1',
      'uk.right_to_work@v1',
      'uk.sds@v1',
      'uk.utr@v1',
    ]);
  });

  it('UK B2B classified IR35-OUTSIDE materialises 3 rows (RTW + UTR + business-registration; no SDS)', () => {
    const ctx: EngagementContext = {
      jurisdiction: 'UK',
      outcome: 'IR35-OUTSIDE',
      sector: null,
      contractorNationality: 'GB',
      requiresRegulatedEquipment: false,
    };
    const rules = resolvePolicyRules(ctx);
    const ids = rules.map(r => r.policyRuleId);
    expect(ids).toContain('uk.right_to_work@v1');
    expect(ids).toContain('uk.utr@v1');
    expect(ids).toContain('uk.business_registration@v1');
    expect(ids).not.toContain('uk.sds@v1');
  });

  it('DE classified ABHANGIG with construction sector materialises A1 + Aufenthaltstitel + §48b EStG', () => {
    const ctx: EngagementContext = {
      jurisdiction: 'DE',
      outcome: 'ABHANGIG',
      sector: 'construction',
      contractorNationality: 'IN', // non-EU triggers Aufenthaltstitel
      requiresRegulatedEquipment: false,
    };
    const rules = resolvePolicyRules(ctx);
    const ids = rules.map(r => r.policyRuleId).sort();
    expect(ids).toEqual(['de.a1@v1', 'de.aufenthaltstitel@v1', 'de.eight_b_estg@v1']);
  });

  it('KSA cross-border resolves Iqama (Asia/Riyadh) + work-permit + Qiwa', () => {
    const ctx: EngagementContext = {
      jurisdiction: 'KSA',
      outcome: 'CROSS_BORDER',
      sector: null,
      contractorNationality: 'IN',
      requiresRegulatedEquipment: false,
    };
    const rules = resolvePolicyRules(ctx);
    const iqama = rules.find(r => r.policyRuleId === 'ksa.iqama@v1');
    expect(iqama).toBeDefined();
    expect(iqama?.expiryJurisdictionTz).toBe('Asia/Riyadh');
    expect(iqama?.severity).toBe('BLOCKING');
    expect(rules.some(r => r.policyRuleId === 'ksa.work_permit_qiwa@v1')).toBe(true);
  });
});
