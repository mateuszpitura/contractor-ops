// ---------------------------------------------------------------------------
// Scheinselbständigkeit (DRV) Rule Set — D-06 / D-08
// ---------------------------------------------------------------------------
//
// 20-criterion DRV inventory across the 4 Scheinselbständigkeit categories:
//   integration (6), entrepreneurial (5), personal-dep (5), economic-dep (4).
// Every criterion carries a `drvReference` (DRV Rundschreiben, §-citation, or
// leading BSG case). Category titles are imported VERBATIM from
// `@contractor-ops/validators` so the locked-phrase CI guard catches any drift.
//
// RESEARCH refs: §Regulatory Domain → Scheinselbständigkeit + scoring test
// coverage; D-14 (weights / thresholds); D-15 (DRV-ECO-01 billing-ratio band).

import {
  CLASSIFICATION_SCHEIN_ECONOMIC_DEP,
  CLASSIFICATION_SCHEIN_ENTREPRENEURIAL,
  CLASSIFICATION_SCHEIN_INTEGRATION,
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE,
  CLASSIFICATION_SCHEIN_PERSONAL_DEP,
} from '@contractor-ops/validators';

import type { ScheinCategory } from '../../types/outcome.js';
import type { RuleSet, RuleSetQuestion } from '../../types/rule-set.js';

/** Rule-set version persisted in the questions snapshot on submit (D-08). */
export const RULE_SET_VERSION = 'SCHEINSELBSTANDIGKEIT-DRV-2024' as const;

/**
 * Category weights per D-14 / DRV Rundschreiben RS 2022/1 guidance.
 * The sum MUST equal exactly 100 — enforced by a unit test.
 */
export const CATEGORY_WEIGHTS = {
  integration: 30,
  entrepreneurial: 30,
  'personal-dep': 25,
  'economic-dep': 15,
} as const satisfies Record<ScheinCategory, number>;

/**
 * Traffic-light thresholds per D-14:
 *   totalScore < green  → green
 *   totalScore ≤ amber  → amber
 *   totalScore > amber  → red
 *
 * Boundary tests: 29.9 → green, 30 → amber, 60 → amber, 60.1 → red.
 */
export const THRESHOLDS = {
  green: 30,
  amber: 60,
} as const;

/**
 * Category titles — VERBATIM constants from packages/validators/src/legal/de.ts.
 * Reference equality is load-bearing: rule-set.test.ts checks `toBe` (===).
 */
export const CATEGORY_TITLES = {
  integration: CLASSIFICATION_SCHEIN_INTEGRATION,
  entrepreneurial: CLASSIFICATION_SCHEIN_ENTREPRENEURIAL,
  'personal-dep': CLASSIFICATION_SCHEIN_PERSONAL_DEP,
  'economic-dep': CLASSIFICATION_SCHEIN_ECONOMIC_DEP,
} as const satisfies Record<ScheinCategory, string>;

/** Re-export for Plan 04 / Plan 05 UI — single source of truth. */
export const NOT_APPLICABLE_LABEL = CLASSIFICATION_SCHEIN_NOT_APPLICABLE;

// ---------------------------------------------------------------------------
// 20-criterion inventory
// ---------------------------------------------------------------------------
//
// NOTE on direction: entrepreneurial-independence criteria are phrased in the
// NEGATIVE ("Kein eigenes ...") so a higher rawScore (stronger Yes) always
// indicates MORE risk of Scheinselbständigkeit — this keeps the scoring
// monotonic across all 20 criteria.

export const SCHEIN_QUESTIONS = [
  // ----- Integration in die Arbeitsorganisation (6) ------------------------
  {
    id: 'DRV-INT-01',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'Working hours are prescribed by the client (Weisungsgebundenheit Zeit).',
      pl: 'Godziny pracy są narzucone przez klienta (Weisungsgebundenheit Zeit).',
      de: 'Die Arbeitszeiten werden vom Auftraggeber vorgegeben (Weisungsgebundenheit Zeit).',
    },
    helpText: {
      en: 'Fixed hours imposed by the client indicate integration.',
      pl: 'Narzucone godziny wskazują na integrację.',
      de: 'Vorgegebene Arbeitszeiten weisen auf Eingliederung hin.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.1 (Weisungsgebundenheit)',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-INT-02',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'Workplace is prescribed by the client (Weisungsgebundenheit Ort).',
      pl: 'Miejsce pracy jest narzucone przez klienta.',
      de: 'Der Arbeitsort wird vom Auftraggeber vorgegeben (Weisungsgebundenheit Ort).',
    },
    helpText: {
      en: 'Mandated on-site work is a classical integration marker.',
      pl: 'Wymuszona praca u klienta to klasyczny znacznik integracji.',
      de: 'Vorgeschriebene Vor-Ort-Arbeit ist ein klassisches Eingliederungsmerkmal.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.1',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-INT-03',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'The manner in which the work is performed is prescribed by the client.',
      pl: 'Sposób wykonania pracy jest narzucony przez klienta.',
      de: 'Die Art und Weise der Arbeitsausführung wird vom Auftraggeber vorgegeben.',
    },
    helpText: {
      en: 'Method control echoes an employment relationship.',
      pl: 'Kontrola metody pracy przypomina stosunek pracy.',
      de: 'Methodensteuerung entspricht einem Beschäftigungsverhältnis.',
    },
    drvReference: '§ 7 Abs 1 SGB IV',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-INT-04',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'The contractor uses the client’s facilities, tools, or IT equipment.',
      pl: 'Wykonawca używa sprzętu, narzędzi lub infrastruktury IT klienta.',
      de: 'Die Arbeitskraft nutzt Betriebsmittel, Werkzeuge oder IT des Auftraggebers.',
    },
    helpText: {
      en: 'Using client assets indicates absorption into the client’s organisation.',
      pl: 'Korzystanie z zasobów klienta świadczy o absorpcji w jego organizację.',
      de: 'Nutzung von Auftraggeber-Mitteln spricht für Eingliederung.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.2',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-INT-05',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'The contractor attends internal team meetings or internal company events.',
      pl: 'Wykonawca uczestniczy w wewnętrznych spotkaniach lub wydarzeniach firmy.',
      de: 'Die Arbeitskraft nimmt an internen Teamsitzungen oder Dienstbesprechungen teil.',
    },
    helpText: {
      en: 'Regular attendance at internal meetings is integration evidence.',
      pl: 'Regularne uczestnictwo w spotkaniach to dowód integracji.',
      de: 'Regelmäßige Teilnahme an internen Sitzungen ist Eingliederungsindiz.',
    },
    drvReference: 'BSG Urteil 04.06.2019 B 12 R 11/18 R',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-INT-06',
    category: 'integration' as ScheinCategory,
    prompt: {
      en: 'The contractor works in a team alongside the client’s permanent employees.',
      pl: 'Wykonawca pracuje w zespole z pracownikami etatowymi klienta.',
      de: 'Die Arbeitskraft arbeitet im Team mit festangestellten Mitarbeitern des Auftraggebers.',
    },
    helpText: {
      en: 'Team membership with employees is a strong Eingliederung signal.',
      pl: 'Przynależność do zespołu z etatowcami to silny sygnał integracji.',
      de: 'Teamzugehörigkeit mit Festangestellten ist ein starkes Eingliederungssignal.',
    },
    drvReference: 'BSG Urteil 12.12.2019 B 12 R 7/19 R',
    answerType: 'score-0-3',
    required: true,
  },

  // ----- Unternehmerische Selbstständigkeit (5) ---------------------------
  // NOTE: Negative phrasing — a higher rawScore means LESS entrepreneurial
  // independence, hence HIGHER Scheinselbständigkeit risk (monotonic direction).
  {
    id: 'DRV-ENT-01',
    category: 'entrepreneurial' as ScheinCategory,
    prompt: {
      en: 'No own business risk (keine eigene unternehmerische Risiko).',
      pl: 'Brak własnego ryzyka biznesowego.',
      de: 'Kein eigenes unternehmerisches Risiko.',
    },
    helpText: {
      en: 'Absence of business risk shifts the scale towards employment.',
      pl: 'Brak ryzyka biznesowego przesuwa ocenę w stronę zatrudnienia.',
      de: 'Fehlendes unternehmerisches Risiko verlagert die Bewertung Richtung Beschäftigung.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.3',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ENT-02',
    category: 'entrepreneurial' as ScheinCategory,
    prompt: {
      en: 'No own business premises (keine eigene Betriebsstätte).',
      pl: 'Brak własnej siedziby przedsiębiorstwa.',
      de: 'Keine eigene Betriebsstätte.',
    },
    helpText: {
      en: 'Without own premises, the contractor lacks visible business autonomy.',
      pl: 'Brak własnej siedziby to brak widocznej autonomii biznesowej.',
      de: 'Ohne eigene Betriebsstätte fehlt sichtbare unternehmerische Autonomie.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.3',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ENT-03',
    category: 'entrepreneurial' as ScheinCategory,
    prompt: {
      en: 'No own employees or subcontractors.',
      pl: 'Brak własnych pracowników ani podwykonawców.',
      de: 'Kein eigenes Personal und keine Subunternehmer.',
    },
    helpText: {
      en: 'Sole-operator mode weakens the entrepreneurial-independence case.',
      pl: 'Samodzielna praca osłabia argument o niezależności.',
      de: 'Ein-Personen-Betrieb schwächt das Selbstständigkeitsmerkmal.',
    },
    drvReference: 'BSG Urteil 31.03.2017 B 12 R 7/15 R',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ENT-04',
    category: 'entrepreneurial' as ScheinCategory,
    prompt: {
      en: 'No own marketing or external branding (keine Außendarstellung).',
      pl: 'Brak własnego marketingu ani branding zewnętrznego.',
      de: 'Keine eigene Außendarstellung oder Werbung.',
    },
    helpText: {
      en: 'Lack of external branding suggests absorption into the client’s identity.',
      pl: 'Brak brandingu zewnętrznego sugeruje absorpcję w tożsamość klienta.',
      de: 'Fehlende Außendarstellung deutet auf Absorption in die Auftraggeber-Identität.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.3',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ENT-05',
    category: 'entrepreneurial' as ScheinCategory,
    prompt: {
      en: 'No significant own capital investment in the business.',
      pl: 'Brak istotnego własnego kapitału obrotowego.',
      de: 'Kein wesentliches eigenes Betriebskapital.',
    },
    helpText: {
      en: 'Capital at risk is a defining self-employment attribute.',
      pl: 'Kapitał ryzyka to cecha definicyjna samozatrudnienia.',
      de: 'Eingesetztes Kapital ist ein definierendes Merkmal der Selbstständigkeit.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.3',
    answerType: 'score-0-3',
    required: true,
  },

  // ----- Persönliche Abhängigkeit (5) --------------------------------------
  {
    id: 'DRV-PER-01',
    category: 'personal-dep' as ScheinCategory,
    prompt: {
      en: 'Personal-service obligation — the worker must perform personally (no substitution).',
      pl: 'Obowiązek osobistego świadczenia — bez prawa zastępstwa.',
      de: 'Persönliche Leistungserbringungspflicht — keine Ersatzstellung erlaubt.',
    },
    helpText: {
      en: 'Compulsory personal performance is a classical dependency marker.',
      pl: 'Obowiązek osobistego wykonywania to klasyczny znacznik zależności.',
      de: 'Pflicht zur persönlichen Leistung ist ein klassisches Abhängigkeitsmerkmal.',
    },
    drvReference: '§ 7 Abs 1 SGB IV',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-PER-02',
    category: 'personal-dep' as ScheinCategory,
    prompt: {
      en: 'Regular, detailed reporting to the client is required.',
      pl: 'Wymagane regularne, szczegółowe raportowanie do klienta.',
      de: 'Regelmäßige und detaillierte Berichtspflicht gegenüber dem Auftraggeber.',
    },
    helpText: {
      en: 'Detailed reporting mirrors supervisory control over an employee.',
      pl: 'Szczegółowe raportowanie przypomina nadzór pracodawcy.',
      de: 'Detaillierte Berichtspflicht entspricht arbeitgeberseitiger Aufsicht.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.4',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-PER-03',
    category: 'personal-dep' as ScheinCategory,
    prompt: {
      en: 'Leave / absence requires client approval.',
      pl: 'Urlop / nieobecność wymaga zgody klienta.',
      de: 'Urlaub oder Abwesenheit ist mit dem Auftraggeber abzustimmen.',
    },
    helpText: {
      en: 'Approval-gated leave is an employment-style dependency.',
      pl: 'Zgoda na urlop to zależność pracownicza.',
      de: 'Genehmigungspflicht für Urlaub ist arbeitnehmertypisch.',
    },
    drvReference: 'BSG Urteil 04.06.2019 B 12 R 11/18 R',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-PER-04',
    category: 'personal-dep' as ScheinCategory,
    prompt: {
      en: 'Fixed monthly salary-like payment (not success / deliverable based).',
      pl: 'Stała miesięczna wypłata typu wynagrodzenie (nie zależna od wyniku).',
      de: 'Feste monatliche Vergütung (nicht erfolgs- oder leistungsbasiert).',
    },
    helpText: {
      en: 'Salary-style pay mirrors an employment remuneration pattern.',
      pl: 'Stała pensja naśladuje wynagrodzenie pracownicze.',
      de: 'Gehaltsähnliche Zahlung entspricht einer Arbeitnehmervergütung.',
    },
    drvReference: 'BSG Urteil 31.03.2017 B 12 R 7/15 R',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-PER-05',
    category: 'personal-dep' as ScheinCategory,
    prompt: {
      en: 'Ongoing engagement without a clear project end.',
      pl: 'Kontynuacja współpracy bez wyraźnego zakończenia projektu.',
      de: 'Kontinuierliche Beschäftigung ohne klares Projektende.',
    },
    helpText: {
      en: 'An open-ended, ongoing engagement echoes a permanent role.',
      pl: 'Bezterminowa ciągłość sugeruje stałe stanowisko.',
      de: 'Unbefristete Dauerhaftigkeit deutet auf eine Festanstellung hin.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.4',
    answerType: 'score-0-3',
    required: true,
  },

  // ----- Wirtschaftliche Abhängigkeit (4) ----------------------------------
  {
    id: 'DRV-ECO-01',
    category: 'economic-dep' as ScheinCategory,
    prompt: {
      en: 'Share of total revenue from this client (% of annual turnover).',
      pl: 'Udział całkowitego przychodu pochodzący od tego klienta (% rocznego obrotu).',
      de: 'Anteil der Gesamteinnahmen von diesem Auftraggeber (% des Jahresumsatzes).',
    },
    helpText: {
      en: 'Arbeitnehmerähnliche Selbstständige rule (§ 2 Nr 9 SGB VI) uses the 5/6-test — >83% is a strong indicator.',
      pl: 'Test 5/6 (§ 2 Nr 9 SGB VI) — >83% to silny wskaźnik zależności ekonomicznej.',
      de: 'Arbeitnehmerähnliche Selbstständige (§ 2 Nr 9 SGB VI) — 5/6-Test; >83% ist ein starkes Indiz.',
    },
    drvReference: '§ 2 Nr 9 SGB VI (5/6-Test)',
    answerType: 'billing-ratio',
    required: true,
  },
  {
    id: 'DRV-ECO-02',
    category: 'economic-dep' as ScheinCategory,
    prompt: {
      en: 'Engagement length exceeds one year.',
      pl: 'Czas trwania współpracy przekracza rok.',
      de: 'Dauer der Zusammenarbeit überschreitet ein Jahr.',
    },
    helpText: {
      en: 'Long-running engagements amplify economic dependency.',
      pl: 'Długotrwałe zlecenia pogłębiają zależność ekonomiczną.',
      de: 'Lang andauernde Aufträge verstärken die wirtschaftliche Abhängigkeit.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.5',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ECO-03',
    category: 'economic-dep' as ScheinCategory,
    prompt: {
      en: 'No active acquisition of other clients.',
      pl: 'Brak aktywnego pozyskiwania innych klientów.',
      de: 'Keine aktive Akquise anderer Kunden.',
    },
    helpText: {
      en: 'Absence of business-development activity suggests single-client dependency.',
      pl: 'Brak aktywności handlowej świadczy o zależności od jednego klienta.',
      de: 'Fehlende Vertriebsaktivität deutet auf Einzelauftraggeberabhängigkeit.',
    },
    drvReference: 'DRV Rundschreiben RS 2022/1 Abschnitt 3.5',
    answerType: 'score-0-3',
    required: true,
  },
  {
    id: 'DRV-ECO-04',
    category: 'economic-dep' as ScheinCategory,
    prompt: {
      en: 'Exclusivity agreement with the client.',
      pl: 'Umowa o wyłączność z klientem.',
      de: 'Exklusivitätsvereinbarung mit dem Auftraggeber.',
    },
    helpText: {
      en: 'Contractual exclusivity is a dispositive economic-dependency marker.',
      pl: 'Wyłączność umowna to rozstrzygający marker zależności ekonomicznej.',
      de: 'Vertragliche Exklusivität ist ein entscheidendes Abhängigkeitsmerkmal.',
    },
    drvReference: 'BSG Urteil 24.03.2016 B 12 KR 20/14 R',
    answerType: 'score-0-3',
    required: true,
  },
] as const satisfies readonly RuleSetQuestion[];

/** Typed rule-set wrapper. */
export const SCHEIN_RULE_SET: RuleSet = {
  profileId: 'scheinselbstandigkeit',
  ruleSetVersion: RULE_SET_VERSION,
  countryCode: 'DE',
  questions: SCHEIN_QUESTIONS,
} as const;
