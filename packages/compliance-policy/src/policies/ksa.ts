// Phase 71 — KSA (Saudi Arabia) policy rules.
//
// Documents covered:
//  1. ksa.iqama@v1 — Iqama residency permit (BLOCKING; 1-year max per Saudi MOI)
//  2. ksa.work_permit_qiwa@v1 — Work permit + Qiwa portal authorisation (BLOCKING)

import { registerPolicyRule } from '../registry';

registerPolicyRule({
  policyRuleId: 'ksa.iqama@v1',
  jurisdiction: 'KSA',
  documentType: 'KSA_IQAMA',
  displayName: 'Iqama (Saudi Residency Permit)',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Asia/Riyadh',
  appliesIf: () => true,
  draftLegalText:
    'All foreign workers in Saudi Arabia must hold a valid Iqama. Saudi MOI issues for up to 1 year, renewable. Without Iqama, the worker cannot legally receive payment for services performed in KSA. (Saudi MOI; PENDING legal review)',
  expirySemantic: 'fixed_months', // Phase 73 D-07 — Iqama issued for up to 1 year
  expiryMonths: 12,
});

registerPolicyRule({
  policyRuleId: 'ksa.work_permit_qiwa@v1',
  jurisdiction: 'KSA',
  documentType: 'KSA_WORK_PERMIT',
  displayName: 'Saudi Work Permit + Qiwa Authorisation',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Asia/Riyadh',
  appliesIf: () => true,
  draftLegalText:
    'Two artefacts in one row: the Saudi work-permit document AND a verifiable boolean from the Qiwa portal. Phase 71 stores the boolean as a notes field; Phase 79 wires the Qiwa API for live verification. (Qiwa portal / MHRSD; PENDING legal review)',
  // TODO Phase 73 D-07 verify with legal: work-permit term typically aligns with the Iqama;
  // 12 months is an auto-fill default the contractor can override.
  expirySemantic: 'fixed_months',
  expiryMonths: 12,
});

// Phase 75 D-07 — IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
registerPolicyRule({
  policyRuleId: 'ksa.ip_assignment@v1',
  jurisdiction: 'KSA',
  documentType: 'IP_RATIFICATION',
  displayName: 'KSA — Transfer of Economic Rights',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Asia/Riyadh',
  appliesIf: () => true,
  draftLegalText:
    'KSA-jurisdiction contracts must transfer economic rights under the Saudi Copyright Law (Royal Decree M/41 of 2003), Article 22, which requires (a) writing, (b) specification of scope/purpose/term/territory of exploitation, and (c) explicit identification of the rights transferred. (PENDING legal review by local adviser)',
  expirySemantic: 'no_expiry', // Phase 73 D-07 — economic-rights transfer is permanent
});
