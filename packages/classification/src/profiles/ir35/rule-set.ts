// ---------------------------------------------------------------------------
// IR35 Rule Set (UK Off-Payroll Working) — D-06 / D-08
// ---------------------------------------------------------------------------
//
// 25 questions across the 5 HMRC CEST areas, each carrying its `caseLawCitation`.
// Ordering is fixed (area-by-area). `prompt.en` is authoritative; `prompt.pl`
// and `prompt.de` are good-faith translations marked with REVIEW tokens so the
// UK tax adviser / Steuerberater review can flag them before go-live.
// All question IDs are stable — never renumber; append-only.
//
// RESEARCH references: §Regulatory Domain → IR35 five areas + case law table
// (Ready Mixed Concrete, Hall v Lorimer, Atholl House, PGMOL).

import type { Ir35Area } from '../../types/outcome.js';
import type { RuleSet, RuleSetQuestion } from '../../types/rule-set.js';

/** Rule-set version persisted in the questions snapshot on submit (D-08). */
export const RULE_SET_VERSION = 'IR35-2024-CEST' as const;

/** Case-law citations reused across area question blocks. */
const CITE_READY_MIXED = 'Ready Mixed Concrete [1968] 2 QB 497' as const;
const CITE_HALL_LORIMER = 'Hall v Lorimer [1994] ICR 218' as const;
const CITE_ATHOLL = 'HMRC v Atholl House [2022] UKSC' as const;
const CITE_PGMOL = 'HMRC v PGMOL [2024] UKSC' as const;

/**
 * Inline influence map — one row per question. Consumed by
 * `area-scoring.ts` to translate a Yes/No answer into a directional
 * signal for the area verdict.
 *
 * 'outside-strong' / 'inside-strong' are dispositive on their area;
 * 'outside-leaning' / 'inside-leaning' are composite signals.
 */
export type YesDirection =
  | 'outside-strong'
  | 'outside-leaning'
  | 'inside-leaning'
  | 'inside-strong'
  | 'neutral';

export const IR35_YES_DIRECTION: Readonly<Record<string, YesDirection>> = Object.freeze({
  // Substitution — Atholl House: dispositive area.
  'Q-SUB-01': 'outside-strong', // Unrestricted substitution right → dispositive outside.
  'Q-SUB-02': 'outside-leaning', // Substitution actually exercised.
  'Q-SUB-03': 'inside-leaning', // Client can reject substitute on non-skill grounds.
  'Q-SUB-04': 'outside-leaning', // Worker pays their substitute.
  'Q-SUB-05': 'inside-strong', // Substitution prohibited → dispositive inside.
  // Control — composite.
  'Q-CTRL-01': 'inside-leaning',
  'Q-CTRL-02': 'inside-leaning',
  'Q-CTRL-03': 'inside-leaning',
  'Q-CTRL-04': 'inside-leaning',
  'Q-CTRL-05': 'outside-leaning',
  'Q-CTRL-06': 'inside-leaning',
  // Financial risk — composite.
  'Q-FIN-01': 'outside-leaning',
  'Q-FIN-02': 'outside-leaning',
  'Q-FIN-03': 'outside-leaning', // 'deliverables' branch of the 5-likert; default Yes→outside.
  'Q-FIN-04': 'inside-leaning',
  'Q-FIN-05': 'outside-leaning',
  // Part-and-parcel — composite.
  'Q-PP-01': 'inside-leaning',
  'Q-PP-02': 'inside-leaning',
  'Q-PP-03': 'inside-leaning',
  'Q-PP-04': 'inside-leaning',
  // MOO — PGMOL: dispositive area.
  'Q-MOO-01': 'inside-leaning',
  'Q-MOO-02': 'inside-leaning',
  'Q-MOO-03': 'inside-strong', // Minimum-hours / retainer guarantee → dispositive inside.
  'Q-MOO-04': 'outside-leaning',
  'Q-MOO-05': 'inside-leaning',
});

/**
 * IR35 question inventory — 25 items.
 *
 * Order is fixed; wizard iterates areas in this order:
 *   substitution → control → financial-risk → part-and-parcel → moo.
 *
 * `prompt.en` is the authoritative legal phrasing. `prompt.pl` and
 * `prompt.de` are good-faith translations; markers:
 *   REVIEW:PL — awaiting UK/PL tax adviser review
 *   REVIEW:DE — awaiting Steuerberater review
 */
export const IR35_QUESTIONS = [
  // ----- Substitution (5) ---------------------------------------------------
  {
    id: 'Q-SUB-01',
    area: 'substitution' as Ir35Area,
    prompt: {
      en: 'Does the worker have an unrestricted right to provide a substitute to perform the service?',
      // REVIEW:PL
      pl: 'Czy wykonawca ma nieograniczone prawo do wyznaczenia zastępcy do świadczenia usługi?',
      // REVIEW:DE
      de: 'Hat die Arbeitskraft ein uneingeschränktes Recht, einen Ersatz zur Leistungserbringung zu stellen?',
    },
    helpText: {
      en: 'Atholl House [2022]: a genuine, unrestricted right of substitution is strongly consistent with self-employment.',
      pl: 'Atholl House [2022]: rzeczywiste, nieograniczone prawo zastępstwa wskazuje na samozatrudnienie.',
      de: 'Atholl House [2022]: Ein echtes, uneingeschränktes Ersatzrecht spricht stark für Selbstständigkeit.',
    },
    caseLawCitation: CITE_ATHOLL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-SUB-02',
    area: 'substitution' as Ir35Area,
    prompt: {
      en: 'Has a substitute actually been provided by the worker at any point during this engagement?',
      pl: 'Czy wykonawca faktycznie wyznaczył zastępcę w trakcie tego zlecenia?',
      de: 'Hat die Arbeitskraft während dieses Auftrags tatsächlich einen Ersatz gestellt?',
    },
    helpText: {
      en: 'Actual exercise of the substitution right corroborates the contractual clause.',
      pl: 'Rzeczywiste skorzystanie z prawa zastępstwa potwierdza klauzulę umowną.',
      de: 'Die tatsächliche Ausübung des Ersatzrechts bestätigt die vertragliche Klausel.',
    },
    caseLawCitation: CITE_ATHOLL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-SUB-03',
    area: 'substitution' as Ir35Area,
    prompt: {
      en: 'Could the client reject a proposed substitute on grounds other than skill or security vetting?',
      pl: 'Czy klient może odrzucić proponowanego zastępcę z powodów innych niż kwalifikacje lub weryfikacja bezpieczeństwa?',
      de: 'Kann der Auftraggeber einen vorgeschlagenen Ersatz aus anderen Gründen als Qualifikation oder Sicherheitsprüfung ablehnen?',
    },
    helpText: {
      en: 'Broad rejection rights dilute the substitution right into a personal-service obligation.',
      pl: 'Szerokie prawa odrzucenia osłabiają prawo zastępstwa do obowiązku osobistego świadczenia.',
      de: 'Weitreichende Ablehnungsrechte höhlen das Ersatzrecht aus — Indiz für persönliche Leistungspflicht.',
    },
    caseLawCitation: CITE_ATHOLL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-SUB-04',
    area: 'substitution' as Ir35Area,
    prompt: {
      en: 'Is the worker contractually required to pay their own substitute out of their own fee?',
      pl: 'Czy wykonawca jest umownie zobowiązany do wypłaty wynagrodzenia zastępcy z własnego honorarium?',
      de: 'Ist die Arbeitskraft vertraglich verpflichtet, den Ersatz aus der eigenen Vergütung zu bezahlen?',
    },
    helpText: {
      en: 'Paying one’s own substitute is a classic self-employment indicator (business of one’s own).',
      pl: 'Wypłata wynagrodzenia zastępcy to klasyczny wskaźnik samozatrudnienia.',
      de: 'Eigene Bezahlung des Ersatzes ist ein klassisches Kennzeichen unternehmerischer Tätigkeit.',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-SUB-05',
    area: 'substitution' as Ir35Area,
    prompt: {
      en: 'Does the contract explicitly prohibit substitution or require personal performance by the named worker?',
      pl: 'Czy umowa wyraźnie zakazuje zastępstwa lub wymaga osobistego świadczenia przez wskazanego wykonawcę?',
      de: 'Verbietet der Vertrag ausdrücklich Ersatzstellung oder verlangt persönliche Leistung durch die benannte Arbeitskraft?',
    },
    helpText: {
      en: 'Explicit prohibition of substitution is dispositive of inside-IR35 on this area (Atholl House).',
      pl: 'Wyraźny zakaz zastępstwa rozstrzyga ten obszar na korzyść inside IR35 (Atholl House).',
      de: 'Ein ausdrückliches Ersatzverbot entscheidet diesen Bereich zugunsten „inside IR35" (Atholl House).',
    },
    caseLawCitation: CITE_ATHOLL,
    answerType: 'yes-no',
    required: false,
  },

  // ----- Control (6) --------------------------------------------------------
  {
    id: 'Q-CTRL-01',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Does the client decide how the work is done on a day-to-day basis?',
      pl: 'Czy klient decyduje, jak praca jest wykonywana na co dzień?',
      de: 'Bestimmt der Auftraggeber die tägliche Art und Weise der Arbeitsausführung?',
    },
    helpText: {
      en: 'Day-to-day method control is a strong control-area signal (Ready Mixed Concrete).',
      pl: 'Bieżąca kontrola metody pracy to silny sygnał w obszarze kontroli (Ready Mixed Concrete).',
      de: 'Tägliche Methodensteuerung ist ein starkes Kontrollmerkmal (Ready Mixed Concrete).',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-CTRL-02',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Does the client decide where the work must be performed?',
      pl: 'Czy klient decyduje, gdzie praca musi być wykonywana?',
      de: 'Bestimmt der Auftraggeber den Arbeitsort?',
    },
    helpText: {
      en: 'Mandated location (on-site only) is consistent with employment.',
      pl: 'Narzucona lokalizacja (wyłącznie u klienta) jest spójna z zatrudnieniem.',
      de: 'Vorgeschriebener Ort (ausschließlich vor Ort) entspricht einem Beschäftigungsverhältnis.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-CTRL-03',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Does the client dictate the hours the worker must be available or working?',
      pl: 'Czy klient narzuca godziny, w których wykonawca musi być dostępny lub pracujący?',
      de: 'Schreibt der Auftraggeber die Arbeitszeiten oder Verfügbarkeitszeiten vor?',
    },
    helpText: {
      en: 'Fixed working hours echo an employment relationship.',
      pl: 'Sztywne godziny pracy przypominają stosunek pracy.',
      de: 'Feste Arbeitszeiten sind ein Beschäftigungsindiz.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-CTRL-04',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Can the client reassign the worker to a different task mid-engagement without renegotiating the contract?',
      pl: 'Czy klient może w trakcie zlecenia przenieść wykonawcę do innego zadania bez renegocjacji umowy?',
      de: 'Kann der Auftraggeber die Arbeitskraft innerhalb des Auftrags ohne Vertragsverhandlung einer anderen Aufgabe zuweisen?',
    },
    helpText: {
      en: 'Open-ended task-assignment mirrors managerial control over an employee.',
      pl: 'Swoboda przypisywania zadań naśladuje kontrolę pracodawcy nad pracownikiem.',
      de: 'Freie Aufgabenzuweisung entspricht der Weisungsbefugnis eines Arbeitgebers.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-CTRL-05',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Does the worker retain freedom over the methods used to deliver the agreed outcome?',
      pl: 'Czy wykonawca zachowuje swobodę w wyborze metod osiągnięcia uzgodnionego rezultatu?',
      de: 'Behält die Arbeitskraft die Freiheit, die Methode zur Erreichung des vereinbarten Ergebnisses zu wählen?',
    },
    helpText: {
      en: 'Method autonomy is an outside-IR35 signal.',
      pl: 'Autonomia metody to sygnał outside IR35.',
      de: 'Methodenautonomie ist ein Indiz für „outside IR35".',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-CTRL-06',
    area: 'control' as Ir35Area,
    prompt: {
      en: 'Must the worker obtain client approval before engaging subcontractors?',
      pl: 'Czy wykonawca musi uzyskać zgodę klienta przed zaangażowaniem podwykonawców?',
      de: 'Muss die Arbeitskraft vor dem Einsatz von Subunternehmern die Zustimmung des Auftraggebers einholen?',
    },
    helpText: {
      en: 'Client gate-keeping on subcontractors reduces genuine business independence.',
      pl: 'Kontrola klienta nad podwykonawcami ogranicza niezależność biznesową.',
      de: 'Die Zustimmungspflicht für Subunternehmer schränkt unternehmerische Unabhängigkeit ein.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: false,
  },

  // ----- Financial risk (5) -------------------------------------------------
  {
    id: 'Q-FIN-01',
    area: 'financial-risk' as Ir35Area,
    prompt: {
      en: 'Does the worker bear the cost of rectifying defective work in their own time and at their own expense?',
      pl: 'Czy wykonawca ponosi koszt poprawy wadliwej pracy we własnym czasie i na własny rachunek?',
      de: 'Trägt die Arbeitskraft die Kosten für Nacharbeiten in eigener Zeit und auf eigene Kosten?',
    },
    helpText: {
      en: 'Bearing the cost of rectification is a classic self-employment marker (Hall v Lorimer).',
      pl: 'Ponoszenie kosztu poprawek to klasyczny wskaźnik samozatrudnienia (Hall v Lorimer).',
      de: 'Die Übernahme der Nacharbeitskosten ist ein klassisches Kennzeichen Selbstständigkeit (Hall v Lorimer).',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-FIN-02',
    area: 'financial-risk' as Ir35Area,
    prompt: {
      en: 'To what extent does the worker provide their own significant equipment to perform the service?',
      pl: 'W jakim stopniu wykonawca dostarcza własny istotny sprzęt do świadczenia usługi?',
      de: 'In welchem Umfang stellt die Arbeitskraft eigene wesentliche Arbeitsmittel zur Leistungserbringung?',
    },
    helpText: {
      en: 'CEST 2025 sharpened this from Yes/No to a 5-point scale to capture "partial" cases.',
      pl: 'CEST 2025 zaostrzył to z Tak/Nie do skali 5-stopniowej, aby ująć przypadki „częściowe".',
      de: 'CEST 2025 hat dies von Ja/Nein zu einer 5-stufigen Skala geschärft, um Teilfälle zu erfassen.',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'likert-5',
    required: true,
  },
  {
    id: 'Q-FIN-03',
    area: 'financial-risk' as Ir35Area,
    prompt: {
      en: 'Is the worker paid per agreed deliverable (fixed-price) rather than by time spent (day rate)?',
      pl: 'Czy wykonawca jest opłacany za ustalone rezultaty (ryczałt) a nie za czas (stawka dzienna)?',
      de: 'Wird die Arbeitskraft nach vereinbarten Leistungsergebnissen (Festpreis) statt nach Zeit (Tagessatz) vergütet?',
    },
    helpText: {
      en: 'Deliverable-based pricing shifts outcome risk to the worker.',
      pl: 'Wynagrodzenie za rezultat przenosi ryzyko wykonania na wykonawcę.',
      de: 'Leistungsbezogene Vergütung verlagert das Ergebnisrisiko auf die Arbeitskraft.',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-FIN-04',
    area: 'financial-risk' as Ir35Area,
    prompt: {
      en: 'Is the worker paid regardless of outcome or performance (guaranteed fee)?',
      pl: 'Czy wykonawca jest opłacany niezależnie od rezultatu lub wydajności (gwarantowana opłata)?',
      de: 'Wird die Arbeitskraft unabhängig von Ergebnis oder Leistung (garantiertes Honorar) vergütet?',
    },
    helpText: {
      en: 'Guaranteed fees regardless of output shift risk away from the worker.',
      pl: 'Gwarantowane honorarium bez względu na wynik zdejmuje ryzyko z wykonawcy.',
      de: 'Ein erfolgsunabhängiges Honorar verlagert das Risiko vom Auftragnehmer weg.',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-FIN-05',
    area: 'financial-risk' as Ir35Area,
    prompt: {
      en: 'Does the worker have genuine exposure to profit or loss beyond the hourly or daily rate?',
      pl: 'Czy wykonawca ma realną ekspozycję na zysk lub stratę poza stawką godzinową lub dzienną?',
      de: 'Ist die Arbeitskraft echten Gewinn- oder Verlustrisiken über den Stunden-/Tagessatz hinaus ausgesetzt?',
    },
    helpText: {
      en: 'Genuine entrepreneurial risk is the strongest Hall v Lorimer indicator.',
      pl: 'Rzeczywiste ryzyko przedsiębiorcze to najsilniejszy wskaźnik z Hall v Lorimer.',
      de: 'Echtes unternehmerisches Risiko ist das stärkste Hall-v-Lorimer-Merkmal.',
    },
    caseLawCitation: CITE_HALL_LORIMER,
    answerType: 'yes-no',
    required: false,
  },

  // ----- Part-and-parcel (4) -----------------------------------------------
  {
    id: 'Q-PP-01',
    area: 'part-and-parcel' as Ir35Area,
    prompt: {
      en: 'Does the worker receive any employee-style benefits (pension, sick pay, paid leave)?',
      pl: 'Czy wykonawca otrzymuje świadczenia typu pracowniczego (emerytura, chorobowe, płatny urlop)?',
      de: 'Erhält die Arbeitskraft arbeitnehmertypische Leistungen (Rente, Lohnfortzahlung, bezahlten Urlaub)?',
    },
    helpText: {
      en: 'Employee-style benefits strongly suggest integration into the client workforce.',
      pl: 'Świadczenia pracownicze silnie sugerują integrację z kadrą klienta.',
      de: 'Arbeitnehmertypische Leistungen sprechen stark für die Eingliederung in die Belegschaft.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-PP-02',
    area: 'part-and-parcel' as Ir35Area,
    prompt: {
      en: 'Is the worker listed in the client’s internal directory or organisation chart?',
      pl: 'Czy wykonawca widnieje w wewnętrznym katalogu lub strukturze organizacyjnej klienta?',
      de: 'Wird die Arbeitskraft im internen Verzeichnis oder Organigramm des Auftraggebers geführt?',
    },
    helpText: {
      en: 'Internal directory listings are part-and-parcel evidence.',
      pl: 'Obecność w wewnętrznym katalogu to dowód „part and parcel".',
      de: 'Eintrag im internen Verzeichnis belegt „part and parcel".',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-PP-03',
    area: 'part-and-parcel' as Ir35Area,
    prompt: {
      en: 'Does the worker attend client staff events, trainings, or performance reviews?',
      pl: 'Czy wykonawca uczestniczy w wydarzeniach, szkoleniach lub ocenach pracowniczych klienta?',
      de: 'Nimmt die Arbeitskraft an Betriebsveranstaltungen, Schulungen oder Leistungsbeurteilungen des Auftraggebers teil?',
    },
    helpText: {
      en: 'Staff-style participation evidences integration.',
      pl: 'Uczestnictwo pracownicze świadczy o integracji.',
      de: 'Mitarbeiterartige Teilnahme belegt Integration.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-PP-04',
    area: 'part-and-parcel' as Ir35Area,
    prompt: {
      en: 'Does the worker have line-management responsibility over client employees?',
      pl: 'Czy wykonawca odpowiada za bezpośrednie zarządzanie pracownikami klienta?',
      de: 'Hat die Arbeitskraft Weisungsbefugnis gegenüber Mitarbeitern des Auftraggebers?',
    },
    helpText: {
      en: 'Managing client staff is a definitive part-and-parcel indicator.',
      pl: 'Zarządzanie personelem klienta to jednoznaczny wskaźnik „part and parcel".',
      de: 'Führung von Mitarbeitern des Auftraggebers ist ein eindeutiges „part and parcel"-Merkmal.',
    },
    caseLawCitation: CITE_READY_MIXED,
    answerType: 'yes-no',
    required: false,
  },

  // ----- MOO (5) ------------------------------------------------------------
  {
    id: 'Q-MOO-01',
    area: 'moo' as Ir35Area,
    prompt: {
      en: 'Is the client obliged to offer further work to the worker after the current engagement ends?',
      pl: 'Czy klient jest zobowiązany oferować wykonawcy dalszą pracę po zakończeniu bieżącego zlecenia?',
      de: 'Ist der Auftraggeber verpflichtet, der Arbeitskraft nach Auftragsende weitere Aufträge anzubieten?',
    },
    helpText: {
      en: 'Continuing offer duty is a core MOO indicator post-PGMOL.',
      pl: 'Obowiązek dalszych ofert to kluczowy wskaźnik MOO po PGMOL.',
      de: 'Fortlaufende Auftragsanbietungspflicht ist ein zentrales MOO-Merkmal nach PGMOL.',
    },
    caseLawCitation: CITE_PGMOL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-MOO-02',
    area: 'moo' as Ir35Area,
    prompt: {
      en: 'Is the worker obliged to accept any further work the client offers?',
      pl: 'Czy wykonawca jest zobowiązany przyjąć każdą dalszą pracę oferowaną przez klienta?',
      de: 'Ist die Arbeitskraft verpflichtet, jede weitere angebotene Arbeit anzunehmen?',
    },
    helpText: {
      en: 'Acceptance obligation completes the classical MOO test.',
      pl: 'Obowiązek przyjęcia pracy dopełnia klasyczny test MOO.',
      de: 'Die Annahmeverpflichtung vervollständigt den klassischen MOO-Test.',
    },
    caseLawCitation: CITE_PGMOL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-MOO-03',
    area: 'moo' as Ir35Area,
    prompt: {
      en: 'Does the contract guarantee minimum hours or a minimum retainer to the worker?',
      pl: 'Czy umowa gwarantuje wykonawcy minimalną liczbę godzin lub minimalne wynagrodzenie retenerowe?',
      de: 'Garantiert der Vertrag der Arbeitskraft eine Mindeststundenzahl oder ein Mindestentgelt?',
    },
    helpText: {
      en: 'Guaranteed minimum commitment is dispositive-inside on MOO (PGMOL).',
      pl: 'Gwarantowane minimum zobowiązań rozstrzyga MOO na korzyść inside (PGMOL).',
      de: 'Garantiertes Mindestmaß entscheidet MOO zugunsten „inside" (PGMOL).',
    },
    caseLawCitation: CITE_PGMOL,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-MOO-04',
    area: 'moo' as Ir35Area,
    prompt: {
      en: 'Can either party terminate the engagement on short notice without penalty?',
      pl: 'Czy każda ze stron może rozwiązać umowę w krótkim terminie bez kary?',
      de: 'Kann jede Partei den Auftrag kurzfristig und ohne Strafe beenden?',
    },
    helpText: {
      en: 'Freedom to terminate mid-engagement undermines any MOO claim.',
      pl: 'Swoboda rozwiązania umowy w trakcie osłabia argument o MOO.',
      de: 'Kurzfristige Beendbarkeit schwächt jede MOO-Annahme.',
    },
    caseLawCitation: CITE_PGMOL,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-MOO-05',
    area: 'moo' as Ir35Area,
    prompt: {
      en: 'Has the engagement been extended or renewed multiple times with the same client?',
      pl: 'Czy zlecenie było wielokrotnie przedłużane lub odnawiane u tego samego klienta?',
      de: 'Wurde der Auftrag mehrfach verlängert oder beim selben Auftraggeber erneuert?',
    },
    helpText: {
      en: 'Repeated renewal is a secondary MOO signal of continuity.',
      pl: 'Powtarzające się przedłużenia to wtórny wskaźnik MOO.',
      de: 'Wiederholte Verlängerungen sind ein sekundäres MOO-Signal.',
    },
    caseLawCitation: CITE_PGMOL,
    answerType: 'yes-no',
    required: false,
  },
] as const satisfies readonly RuleSetQuestion[];

/** Typed rule-set wrapper (RuleSet shape from Plan 01). */
export const IR35_RULE_SET: RuleSet = {
  profileId: 'ir35',
  ruleSetVersion: RULE_SET_VERSION,
  countryCode: 'GB',
  questions: IR35_QUESTIONS,
} as const;
