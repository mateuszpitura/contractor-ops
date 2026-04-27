// Phase 71 — KSA (Saudi Arabia) policy rules.
//
// Documents covered:
//  1. ksa.iqama@v1 — Iqama residency permit (BLOCKING; 1-year max per Saudi MOI)
//  2. ksa.work_permit_qiwa@v1 — Work permit + Qiwa portal authorisation (BLOCKING)

import { registerPolicyRule } from '../registry.js';

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
});
