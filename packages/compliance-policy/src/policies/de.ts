// DE policy rules.
//
// Documents covered:
//  1. de.a1@v1 — A1-Bescheinigung (BLOCKING; 24-month max per EU Reg 883/2004)
//  2. de.aufenthaltstitel@v1 — Aufenthaltstitel residence permit (BLOCKING; conditional on non-EU nationality)
//  3. de.eight_b_estg@v1 — §48b EStG Freistellungsbescheinigung (BLOCKING; conditional on construction sector)

import { registerLeaveAccrualRule } from '../leave-registry';
import { registerPolicyRule } from '../registry';
import { registerWorkingTimeLimit } from '../wt-registry';

const EU_NATIONALITIES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  // EFTA states with equivalent residency rights
  'IS',
  'LI',
  'NO',
  'CH',
]);

registerPolicyRule({
  policyRuleId: 'de.a1@v1',
  jurisdiction: 'DE',
  documentType: 'DE_A1_BESCHEINIGUNG',
  displayName: 'A1-Bescheinigung',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/Berlin',
  appliesIf: () => true,
  draftLegalText:
    'Issued by Deutsche Rentenversicherung; certifies that social-security contributions are paid in the originating country during a cross-border posting. EU Reg 883/2004 Art 12 caps the validity at 24 months. Without A1, the receiving country can claim concurrent contributions. (DRV / EU Reg 883/2004 Art 12; PENDING legal review)',
  expirySemantic: 'fixed_months', // 24-month cap per EU Reg 883/2004 Art 12
  expiryMonths: 24,
});

registerPolicyRule({
  policyRuleId: 'de.aufenthaltstitel@v1',
  jurisdiction: 'DE',
  documentType: 'DE_AUFENTHALTSTITEL',
  displayName: 'Aufenthaltstitel (residence permit)',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/Berlin',
  appliesIf: ctx =>
    ctx.contractorNationality !== null &&
    !EU_NATIONALITIES.has(ctx.contractorNationality.toUpperCase()),
  draftLegalText:
    "Required for non-EU/EEA/Swiss contractors performing work in Germany. AufenthG §4 sets the legal basis. The permit's expiry date is typed on the document itself. (AufenthG §4; PENDING legal review)",
  // TODO verify with legal: the permit's true expiry is printed on the
  // document; 36 months is a conservative auto-fill default the contractor can override.
  expirySemantic: 'fixed_months',
  expiryMonths: 36,
});

registerPolicyRule({
  policyRuleId: 'de.eight_b_estg@v1',
  jurisdiction: 'DE',
  documentType: 'DE_FREISTELLUNGSBESCHEINIGUNG',
  displayName: 'Freistellungsbescheinigung §48b EStG',
  severity: 'BLOCKING',
  expiryJurisdictionTz: 'Europe/Berlin',
  appliesIf: ctx => ctx.sector === 'construction',
  draftLegalText:
    'Required for construction-sector engagements. Without §48b, the principal must withhold 15% Bauabzugsteuer at source. Issued by the Finanzamt; valid up to 3 years. (EStG §48b; PENDING legal review)',
  expirySemantic: 'fixed_months', // Freistellungsbescheinigung valid up to 3 years
  expiryMonths: 36,
});

// Werkvertrag IP-rights must be granted as Nutzungsrechte, NOT assignment.
// §7 UrhG Schöpferprinzip makes authorship inalienable; UK-style
// "hereby assigns" boilerplate is INSUFFICIENT under DE law.
registerPolicyRule({
  policyRuleId: 'de.werkvertrag_ip@v1',
  jurisdiction: 'DE',
  documentType: 'IP_RATIFICATION',
  displayName: 'DE Werkvertrag — Einräumung von Nutzungsrechten',
  severity: 'WARNING',
  expiryJurisdictionTz: 'Europe/Berlin',
  appliesIf: () => true,
  draftLegalText:
    "DE-jurisdiction contracts MUST grant Nutzungsrechte per UrhG §31 (Einräumung von Nutzungsrechten — exclusive `ausschließliches Nutzungsrecht` or non-exclusive `einfaches Nutzungsrecht`) rather than transfer authorship. UrhG §7 (Schöpferprinzip) makes authorship inalienable: only natural persons can be authors and rights cannot be assigned. UK-style 'hereby assigns' boilerplate is INSUFFICIENT under DE law — Phase 75 verdict engine triggers MANUAL_REVIEW_REQUIRED with crossJurisdictionMismatch flag (D-15) when only UK-namespace phrases match a DE contract. UrhG §31 Abs. 5 (Zweckübertragungsregel) further constrains the scope of granted rights to what the contractual purpose requires. (PENDING legal review by Steuerberater + Werkvertrag-aware adviser)",
  expirySemantic: 'no_expiry', // usage-rights grant is permanent
});

// Statutory minimum annual leave. BUrlG states 24 Werktage on a 6-day week,
// which is the widely-cited 20 Arbeitstage on the standard 5-day week; CBAs and
// contracts routinely raise this to 25-30 days (org override, not encoded here).
registerLeaveAccrualRule({
  jurisdiction: 'DE',
  leaveKind: 'ANNUAL',
  baseEntitlementDays: () => 20,
  proRataByEtat: true,
  carryoverPolicy: { maxDays: null, expiresMonthsIntoNextYear: 3 },
  draftLegalText:
    'BUrlG §3: gesetzlicher Mindesturlaub 24 Werktage (6-Tage-Woche) = mind. 20 Arbeitstage (5-Tage-Woche). Tarifvertrag/Arbeitsvertrag heben dies häufig auf 25-30 Tage an (Org-Override). Resturlaub verfällt grundsätzlich zum 31.03. des Folgejahres bei Übertragung (§7 Abs. 3; adviser-verify). [CITED: BUrlG §3] (PENDING legal review by Steuerberater)',
});

registerWorkingTimeLimit({
  jurisdiction: 'DE',
  maxDailyMinutes: 480,
  maxDailyHardCeilingMinutes: 600,
  weeklyAvgMaxMinutes: 2880,
  weeklyWindowWeeks: 24,
  weeklyOptOutAllowed: false,
  nightWindow: { startHour: 23, endHour: 6 },
  // No fixed statutory overtime premium in ArbZG — OT/night pay is contract/CBA
  // governed (§6 Abs. 5 requires an "angemessener" night surcharge or time off),
  // so no numeric premium is encoded here; payroll applies the CBA rate.
  draftLegalText:
    'ArbZG §3: werktägliche Arbeitszeit 8h, verlängerbar auf 10h wenn im 6-Monats-/24-Wochen-Durchschnitt ≤8h. Nachtzeit 23:00-06:00 (Bäckereien/Konditoreien 22:00-05:00); Nachtarbeit = >2h in der Nachtzeit; §6 Abs. 5 verlangt einen angemessenen Zuschlag ODER Freizeitausgleich — kein fester gesetzlicher Prozentsatz (tarifabhängig, oft ~25%; [ASSUMED, adviser-verify]). Kein gesetzlicher Überstundenzuschlag in ArbZG (vertraglich/tariflich geregelt). [CITED: ArbZG §3/§6] (PENDING legal review by Steuerberater)',
});
