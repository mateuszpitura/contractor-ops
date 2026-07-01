// UK policy rules.
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

import { registerLeaveAccrualRule } from '../leave-registry';
import { registerPolicyRule } from '../registry';
import { registerWorkingTimeLimit } from '../wt-registry';

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
  expirySemantic: 'fixed_days', // share code valid 90 days from generation
  expiryDays: 90,
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
  expirySemantic: 'no_expiry', // UTR is non-expiring
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
    'UK limited-company contractors must be active in Companies House. The 8-digit company number is the canonical identifier; status is re-verified on cadence by the cron worker. (Companies House; PENDING legal review)',
  expirySemantic: 'no_expiry', // registration is non-expiring (status re-verified on cadence, not a fixed doc expiry)
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
  expirySemantic: 'no_expiry', // SDS tied to the engagement, not a fixed-term doc
});

// IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
registerPolicyRule({
  policyRuleId: 'uk.ip_assignment@v1',
  jurisdiction: 'UK',
  documentType: 'IP_RATIFICATION',
  displayName: 'UK Intellectual Property Assignment',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/London',
  appliesIf: () => true,
  draftLegalText:
    "UK contractors must execute an IP-assignment under Copyright, Designs and Patents Act 1988 s.90(1) (assignment) and s.91 (future copyright). Best practice includes: 'hereby (absolutely and irrevocably) assigns', 'present and future rights', and an explicit waiver of moral rights under CDPA 1988 s.87. (PENDING legal review by UK adviser)",
  expirySemantic: 'no_expiry', // executed IP assignment is permanent
});

// Statutory annual leave — 5.6 weeks, capped at 28 days for a 5-day-week worker
// (reg 13 gives 4 weeks, reg 13A adds 1.6 weeks). Part-time scales pro-rata by
// etat. Only the reg-13A 1.6-week portion (8 days) may carry into the next leave
// year by agreement; the reg-13 4-week portion is generally use-it-or-lose-it.
registerLeaveAccrualRule({
  jurisdiction: 'UK',
  leaveKind: 'ANNUAL',
  baseEntitlementDays: () => 28,
  proRataByEtat: true,
  carryoverPolicy: { maxDays: 8, expiresMonthsIntoNextYear: 12 },
  draftLegalText:
    'WTR 1998 reg 13 (4 weeks) + reg 13A (1.6 weeks) = 5.6 weeks, capped at 28 days for a 5-day week. Part-time pro-rata. Reg-13A 1.6 weeks (up to 8 days) may be carried into the next leave year by a relevant agreement; the reg-13 4 weeks generally cannot be carried ([ASSUMED, adviser-verify]). [CITED: WTR 1998 reg 13/13A] (PENDING legal review by UK adviser)',
});

registerWorkingTimeLimit({
  jurisdiction: 'UK',
  maxDailyMinutes: null,
  maxDailyHardCeilingMinutes: null,
  weeklyAvgMaxMinutes: 2880,
  weeklyWindowWeeks: 17,
  weeklyOptOutAllowed: true,
  nightWindow: { startHour: 23, endHour: 6 },
  // No statutory overtime premium under the WTR — overtime pay is contract-governed.
  draftLegalText:
    'WTR 1998 reg 4: average 48h/week over a 17-week reference period, with an individual written opt-out permitted (store the flag). Reg 6: night workers average ≤8h per 24h with NO opt-out from the night limit; a night worker normally works ≥3h between 23:00-06:00. No statutory daily maximum and no statutory overtime premium (contract-governed). [CITED: WTR 1998 reg 4/6] (PENDING legal review by UK adviser)',
});
