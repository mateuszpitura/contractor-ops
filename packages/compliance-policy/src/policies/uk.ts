// Phase 71 — UK policy rules.
//
// Documents covered:
//  1. uk.right_to_work@v1 — UK Right-to-Work share code (BLOCKING)
//  2. uk.utr@v1 — HMRC UTR (WARNING; non-expiring)
//  3. uk.business_registration@v1 — Companies House registration (WARNING)
//  4. uk.sds@v1 — Status Determination Statement (BLOCKING; conditional on IR35-INSIDE)
//
// Legal-text status: PENDING per Standing Constraint (legal review DEFERRED).
// Production wording flips PENDING→APPROVED via post-deploy PR per
// `packages/feature-flags/src/signoff-registry-flags.json`.

import { registerPolicyRule } from '../registry';

registerPolicyRule({
  policyRuleId: 'uk.right_to_work@v1',
  jurisdiction: 'UK',
  documentType: 'UK_RIGHT_TO_WORK_SHARE_CODE',
  displayName: 'UK Right-to-Work Share Code',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/London',
  appliesIf: () => true,
  draftLegalText:
    "Employer must verify the contractor's right to work in the UK via a Home Office share code prior to engagement. Share codes expire 90 days from generation; the verification record (not the underlying status) is the artefact tracked here. (Border Security Act 2025 / gov.uk/right-to-work-checks; PENDING legal review)",
});

registerPolicyRule({
  policyRuleId: 'uk.utr@v1',
  jurisdiction: 'UK',
  documentType: 'UK_UTR',
  displayName: 'HMRC Unique Taxpayer Reference (UTR)',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/London',
  appliesIf: () => true,
  draftLegalText:
    'Sole traders and limited-company contractors must hold a 10-digit HMRC UTR. Non-expiring — once issued, the UTR is valid for the lifetime of the entity. (HMRC; PENDING legal review)',
});

registerPolicyRule({
  policyRuleId: 'uk.business_registration@v1',
  jurisdiction: 'UK',
  documentType: 'BUSINESS_REGISTRATION',
  displayName: 'Companies House Business Registration',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/London',
  appliesIf: () => true,
  draftLegalText:
    'UK limited-company contractors must be active in Companies House. The 8-digit company number is the canonical identifier; status is re-verified on cadence by the Phase 72 cron worker. (Companies House; PENDING legal review)',
});

registerPolicyRule({
  policyRuleId: 'uk.sds@v1',
  jurisdiction: 'UK',
  documentType: 'UK_SDS',
  displayName: 'IR35 Status Determination Statement',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/London',
  appliesIf: ctx => ctx.outcome === 'IR35-INSIDE',
  draftLegalText:
    'Required by Chapter 10 ITEPA 2003 when the engagement is determined to be inside IR35. Without a written SDS the deemed-employer rule does not engage and PAYE deductions cannot be made; payment must be held until the SDS is produced. (HMRC ESM10000; PENDING legal review)',
});
