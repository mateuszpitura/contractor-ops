// PL policy rules.
//
// Documents covered:
//  1. pl.zus_a1@v1 — ZUS A1 (BLOCKING; 12-month max per PL implementation)
//  2. pl.udt@v1 — UDT certification (WARNING; conditional on regulated equipment)

import { registerLeaveAccrualRule } from '../leave-registry';
import { registerPolicyRule } from '../registry';
import { registerWorkingTimeLimit } from '../wt-registry';

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
  expirySemantic: 'fixed_months', // PL implementation caps at 12 months
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
  // TODO verify with legal: validity varies per equipment class;
  // 60 months is an auto-fill default the contractor can override from the certificate.
  expirySemantic: 'fixed_months',
  expiryMonths: 60,
});

// IP-assignment requirement surfaced at offboarding (WARNING; non-blocking).
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
  expirySemantic: 'no_expiry', // economic-rights transfer is permanent
});

// Annual paid leave — the statutory floor scales by total tenure (education
// periods count toward the threshold); part-time scales by etat, rounding a
// partial day UP; unused leave must be granted by 30 September of the next year.
registerLeaveAccrualRule({
  jurisdiction: 'PL',
  leaveKind: 'ANNUAL',
  baseEntitlementDays: ({ tenureYears }) => (tenureYears >= 10 ? 26 : 20),
  proRataByEtat: true,
  carryoverPolicy: { maxDays: null, expiresMonthsIntoNextYear: 9 },
  draftLegalText:
    'KP art. 154 §1: 20 dni urlopu przy stażu <10 lat, 26 dni przy stażu ≥10 lat (staż wlicza okresy nauki). Część etatu proporcjonalnie, niepełny dzień zaokrągla się w górę (art. 154 §2). Niewykorzystany urlop pracodawca udziela do 30 września następnego roku (art. 168; adviser-verify). [CITED: KP art. 154] (PENDING legal review by doradca podatkowy)',
});

registerWorkingTimeLimit({
  jurisdiction: 'PL',
  maxDailyMinutes: 480,
  maxDailyHardCeilingMinutes: null,
  weeklyAvgMaxMinutes: 2880,
  weeklyWindowWeeks: 16,
  weeklyOptOutAllowed: false,
  nightWindow: { startHour: 21, endHour: 7 },
  overtimePremium: { standardPct: 50, premiumPct: 100 },
  draftLegalText:
    'KP art. 129 §1 (8h/dobę, śr. 40h w 5-dniowym tygodniu, okres rozliczeniowy ≤4 mies.), art. 131 §1 (śr. 48h/tydzień łącznie z nadgodzinami w okresie rozliczeniowym), art. 151¹ §1 (dodatek 50% za standardowe nadgodziny; 100% za pracę w nocy, w niedziele/święta niebędące dniami pracy, w dniu wolnym i za przekroczenie normy tygodniowej), art. 151⁷ (pora nocna: 8h między 21:00 a 07:00). [CITED: KP art. 129/131/151] (PENDING legal review)',
});
