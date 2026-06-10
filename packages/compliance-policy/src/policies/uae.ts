// UAE policy rules.
//
// Documents covered:
//  1. uae.emirates_id@v1 — Emirates ID (BLOCKING)
//  2. uae.free_zone_license@v2 — Free-zone trade license (BLOCKING; annually renewed)
//
// The free-zone rule is BLOCKING and its row is written OUT-OF-BAND from the
// FreeZoneAssignment service (free-zone-compliance.ts), NOT via the
// classification → resolvePolicyRules path. `appliesIf` therefore returns
// false so the classification engine never materialises a free-zone item (which
// would lack the zone discriminator and wrongly block Mainland contractors).
// The Mainland gate lives in the service write, not here.

import { registerPolicyRule } from '../registry';

registerPolicyRule({
  policyRuleId: 'uae.emirates_id@v1',
  jurisdiction: 'UAE',
  documentType: 'UAE_EMIRATES_ID',
  displayName: 'Emirates ID',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Asia/Dubai',
  appliesIf: () => true,
  draftLegalText:
    'ICA-issued (Federal Authority for Identity, Citizenship, Customs & Port Security). Required for all UAE residents and freelancers. Validity typed on the card; usually 1–3 years. (ICA; PENDING legal review)',
  // TODO verify with legal: validity is typed on the card (1–3 years);
  // 24 months is an auto-fill default the contractor can override.
  expirySemantic: 'fixed_months',
  expiryMonths: 24,
});

registerPolicyRule({
  policyRuleId: 'uae.free_zone_license@v2',
  jurisdiction: 'UAE',
  documentType: 'UAE_FREE_ZONE_LICENSE',
  displayName: 'UAE Free-Zone Trade License',
  severity: 'BLOCKING', // expired free-zone license hard-blocks payment
  expiryJurisdictionTz: 'Asia/Dubai',
  // NEVER materialised by the classification path. EngagementContext carries no
  // zone discriminator, so resolving this rule there would arm the BLOCKING gate
  // for Mainland (DED-licensed) contractors too. The row is written from
  // free-zone-compliance.ts which applies the zone gate.
  appliesIf: () => false,
  draftLegalText:
    'Required for freelancers operating from UAE free zones (DMCC, ADGM, DIFC, etc.). License number is the canonical identifier; renewal cadence is yearly. (Free-zone authority; PENDING legal review)',
  expirySemantic: 'fixed_months', // free-zone licence renews yearly
  expiryMonths: 12,
});

// IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
registerPolicyRule({
  policyRuleId: 'uae.ip_assignment@v1',
  jurisdiction: 'UAE',
  documentType: 'IP_RATIFICATION',
  displayName: 'UAE — Disposition of Economic Rights',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Asia/Dubai',
  appliesIf: () => true,
  draftLegalText:
    'UAE-jurisdiction contracts must dispose of economic rights under UAE Federal Law No. 38 of 2021 on Copyright and Neighbouring Rights, Article 9, which requires the disposition (a) be in writing, (b) specify the rights, (c) specify the purpose, duration and place of exploitation. Moral rights are NON-disposable. (PENDING legal review by local adviser)',
  expirySemantic: 'no_expiry', // economic-rights disposition is permanent
});
