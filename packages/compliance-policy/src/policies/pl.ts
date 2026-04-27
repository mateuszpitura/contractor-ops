// Phase 71 — PL policy rules.
//
// Documents covered:
//  1. pl.zus_a1@v1 — ZUS A1 (BLOCKING; 12-month max per PL implementation)
//  2. pl.udt@v1 — UDT certification (WARNING; conditional on regulated equipment)

import { registerPolicyRule } from '../registry.js';

registerPolicyRule({
  policyRuleId: 'pl.zus_a1@v1',
  jurisdiction: 'PL',
  documentType: 'PL_ZUS_A1',
  displayName: 'ZUS A1 (zaświadczenie A1 z ZUS)',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/Warsaw',
  appliesIf: () => true,
  draftLegalText:
    'Issued by ZUS via the RUS-3 form; certifies social-insurance coverage in Poland during a cross-border posting. Polish implementation tightens the EU 24-month ceiling to 12 months max. (ZUS / EU Reg 883/2004 Art 12; PENDING legal review)',
});

registerPolicyRule({
  policyRuleId: 'pl.udt@v1',
  jurisdiction: 'PL',
  documentType: 'PL_UDT_CERT',
  displayName: 'UDT (Urząd Dozoru Technicznego) certification',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/Warsaw',
  appliesIf: ctx => ctx.requiresRegulatedEquipment,
  draftLegalText:
    'Required for contractors operating regulated industrial equipment (cranes, lifts, pressure vessels). Validity varies per equipment class; expiry is typed on the certification. (UDT; PENDING legal review)',
});
