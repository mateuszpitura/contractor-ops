// Phase 71 — PL policy rules.
//
// Documents covered:
//  1. pl.zus_a1@v1 — ZUS A1 (BLOCKING; 12-month max per PL implementation)
//  2. pl.udt@v1 — UDT certification (WARNING; conditional on regulated equipment)

import { registerPolicyRule } from '../registry';

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
  expirySemantic: 'fixed_months', // Phase 73 D-07 — PL implementation caps at 12 months
  expiryMonths: 12,
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
  // TODO Phase 73 D-07 verify with legal: validity varies per equipment class;
  // 60 months is an auto-fill default the contractor can override from the certificate.
  expirySemantic: 'fixed_months',
  expiryMonths: 60,
});

// Phase 75 D-07 — IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
registerPolicyRule({
  policyRuleId: 'pl.ip_assignment@v1',
  jurisdiction: 'PL',
  documentType: 'IP_RATIFICATION',
  displayName: 'PL — Przeniesienie autorskich praw majątkowych',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/Warsaw',
  appliesIf: () => true,
  draftLegalText:
    'Polish contracts must transfer or license autorskie prawa majątkowe (economic copyright) under Ustawa o prawie autorskim i prawach pokrewnych (1994). Art. 41 covers the transfer; Art. 50 enumerates the pola eksploatacji (fields of exploitation) that must be specified explicitly; Art. 67 governs licencja wyłączna (exclusive licence) as an alternative. Personal moral rights (autorskie prawa osobiste) are NON-transferable under Art. 16. (PENDING legal review by doradca podatkowy)',
  expirySemantic: 'no_expiry', // Phase 73 D-07 — economic-rights transfer is permanent
});
