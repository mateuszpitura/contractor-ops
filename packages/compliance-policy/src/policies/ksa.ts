// KSA (Saudi Arabia) policy rules.
//
// Documents covered:
//  1. ksa.iqama@v1 — Iqama residency permit (BLOCKING; 1-year max per Saudi MOI)
//  2. ksa.work_permit_qiwa@v1 — Work permit + Qiwa portal authorisation (BLOCKING)

import { registerLeaveAccrualRule } from '../leave-registry';
import { registerPolicyRule } from '../registry';
import { registerWorkingTimeLimit } from '../wt-registry';

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
  expirySemantic: 'fixed_months', // Iqama issued for up to 1 year
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
    'Two artefacts in one row: the Saudi work-permit document AND a verifiable boolean from the Qiwa portal. The boolean is stored as a notes field; Qiwa API live verification is wired separately. (Qiwa portal / MHRSD; PENDING legal review)',
  // TODO verify with legal: work-permit term typically aligns with the Iqama;
  // 12 months is an auto-fill default the contractor can override.
  expirySemantic: 'fixed_months',
  expiryMonths: 12,
});

// IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
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
  expirySemantic: 'no_expiry', // economic-rights transfer is permanent
});

// Statutory annual leave — 21 days per year, rising to 30 days once the worker
// has completed 5 continuous years of service. Part-time scales pro-rata by etat.
registerLeaveAccrualRule({
  jurisdiction: 'KSA',
  leaveKind: 'ANNUAL',
  baseEntitlementDays: ({ tenureYears }) => (tenureYears >= 5 ? 30 : 21),
  proRataByEtat: true,
  carryoverPolicy: { maxDays: null, expiresMonthsIntoNextYear: null },
  draftLegalText:
    'Saudi Labour Law (Royal Decree No. M/51) Art. 109: not less than 21 days of paid annual leave, increased to 30 days after 5 continuous years with the same employer. Leave may be deferred by agreement; no fixed statutory lapse deadline is encoded here (adviser-verify). Part-time pro-rata by etat. [CITED: Saudi Labour Law Art. 109] (PENDING legal review by local adviser)',
});

registerWorkingTimeLimit({
  jurisdiction: 'KSA',
  maxDailyMinutes: 480,
  maxDailyHardCeilingMinutes: null,
  weeklyAvgMaxMinutes: 2880, // 48h/week
  weeklyWindowWeeks: 1,
  weeklyOptOutAllowed: false,
  nightWindow: null, // no statutory night-premium window defined in the same cap-oriented shape
  overtimePremium: { standardPct: 50, premiumPct: 50 },
  draftLegalText:
    'Saudi Labour Law (Royal Decree No. M/51) Art. 98: normal hours 8h/day or 48h/week, reduced to 6h/day or 36h/week for Muslim workers during Ramadan ([ASSUMED, adviser-verify]; not modelled here). Art. 107: overtime paid at +50% of the basic wage. Ceilings vary by sector/role (adviser-verify). [CITED: Saudi Labour Law Art. 98/107] (PENDING legal review by local adviser)',
});
