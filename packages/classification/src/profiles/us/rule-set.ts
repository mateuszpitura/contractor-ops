// ---------------------------------------------------------------------------
// US Worker-Classification Rule Set (federal common-law + CA AB5 + §530)
// ---------------------------------------------------------------------------
//
// Three question groups:
//   - the federal IRS common-law three-category base (behavioral / financial /
//     relationship) — deliberately NOT the DOL 2024 economic-reality rule, which
//     is under active rulemaking and surfaces only as adviser context;
//   - the California AB5 "ABC" prongs (CA Labor Code §2775-2785), applied as a
//     dispositive overlay when the work is performed in California;
//   - the §530 (Revenue Act of 1978) safe-harbor relief conditions, surfaced as
//     an eligibility flag — never a verdict change.
//
// `prompt.en` is the authoritative phrasing; `prompt.pl` / `prompt.de` are
// good-faith translations carrying REVIEW tokens until a US tax adviser /
// Steuerberater signs them off. All question IDs are stable — append-only,
// never renumbered. Every factor is adviser-verify: nothing here is final legal
// advice, and the AB5 professional-services / B2B exemptions are modelled as
// adviser-confirm context, never an automatic determination.

import type { AnswerType, LocalisedText, RuleSet, RuleSetQuestion } from '../../types/rule-set.js';

/** Rule-set version frozen into the questions snapshot on submit. */
export const RULE_SET_VERSION = 'US-2026-COMMONLAW-AB5' as const;

/** Statute / case-law citations reused across the question groups. */
const CITE_COMMON_LAW = 'IRS common-law test — Rev. Rul. 87-41; Form SS-8' as const;
const CITE_AB5 = 'CA Labor Code §2775-2785 (Dynamex; AB5 ABC test)' as const;
const CITE_AB5_B2B =
  'CA Labor Code §2776 (B2B / professional-services exemption, 12 criteria)' as const;
const CITE_SECTION_530 = '§530 of the Revenue Act of 1978 (safe-harbor relief)' as const;

/** Direction a "yes" answer pushes a federal common-law factor. */
export type UsYesDirection = 'employee' | 'contractor';

/**
 * Federal common-law influence map — one row per scored federal question. A
 * "yes" pushes toward the mapped direction; a "no" pushes the opposite way.
 * AB5 prongs and §530 conditions are handled by dedicated scoring branches and
 * are intentionally absent here.
 */
export const US_FEDERAL_YES_DIRECTION: Readonly<Record<string, UsYesDirection>> = Object.freeze({
  'Q-USFED-BEH-01': 'employee', // Client instructs how/when/where work is done.
  'Q-USFED-BEH-02': 'employee', // Client trains the worker in its methods.
  'Q-USFED-BEH-03': 'employee', // Client evaluates how the work is done, not just the result.
  'Q-USFED-FIN-01': 'contractor', // Worker bears profit/loss risk and unreimbursed expenses.
  'Q-USFED-FIN-02': 'contractor', // Worker markets services to multiple clients.
  'Q-USFED-FIN-03': 'employee', // Worker paid a recurring wage rather than per job.
  'Q-USFED-REL-01': 'employee', // Services are integral to the client's regular business.
  'Q-USFED-REL-02': 'contractor', // Written agreement describes an independent-contractor relationship.
  'Q-USFED-REL-03': 'employee', // Worker receives employee-type benefits.
});

/** The three AB5 "ABC" prong question IDs — all three must pass for contractor status. */
export const US_AB5_PRONG_IDS = ['Q-USAB5-A', 'Q-USAB5-B', 'Q-USAB5-C'] as const;

/** The §530 safe-harbor consistency conditions gating the relief flag. */
export const US_SECTION_530_CONSISTENCY_IDS = ['Q-US530-01', 'Q-US530-02'] as const;

/** All §530 condition IDs (consistency requirements + reasonable-basis context). */
export const US_SECTION_530_IDS = ['Q-US530-01', 'Q-US530-02', 'Q-US530-03'] as const;

/** Reserved answer-map key carrying the resolved engagement work state into scoring. */
export const US_WORK_STATE_CONTEXT_KEY = 'US_WORK_STATE' as const;

type UsPrompt = LocalisedText;
type UsHelp = LocalisedText;

/** A single US classification question — federal factor, AB5 prong, or §530 condition. */
interface UsQuestion {
  readonly id: string;
  readonly category: 'behavioral' | 'financial' | 'relationship' | 'ab5' | 'section530';
  readonly prompt: UsPrompt;
  readonly helpText: UsHelp;
  readonly citation: string;
  readonly adviserVerify: true;
  readonly answerType: AnswerType;
  readonly required: boolean;
}

/**
 * US classification question inventory — 15 items.
 *
 * Order is fixed; the wizard iterates federal (behavioral → financial →
 * relationship) then the AB5 overlay then the §530 relief conditions.
 */
export const US_QUESTIONS = [
  // ----- Federal common-law: behavioral control (3) ------------------------
  {
    id: 'Q-USFED-BEH-01',
    category: 'behavioral',
    prompt: {
      en: 'Does the client instruct how, when, or where the worker performs the work on a day-to-day basis?',
      // REVIEW:PL
      pl: 'Czy klient instruuje, jak, kiedy lub gdzie wykonawca wykonuje pracę na co dzień?',
      // REVIEW:DE
      de: 'Weist der Auftraggeber im Alltag an, wie, wann oder wo die Arbeit ausgeführt wird?',
    },
    helpText: {
      en: 'Behavioral control — the right to direct the details of the work is the strongest common-law indicator of employment. Adviser-verify.',
      pl: 'Kontrola behawioralna — prawo do kierowania szczegółami pracy to najsilniejszy wskaźnik zatrudnienia w prawie zwyczajowym. Do weryfikacji przez doradcę.',
      de: 'Verhaltenskontrolle — das Recht, die Arbeitsdetails zu bestimmen, ist das stärkste Common-Law-Indiz für ein Arbeitsverhältnis. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USFED-BEH-02',
    category: 'behavioral',
    prompt: {
      en: 'Does the client provide training that tells the worker to perform the work in a particular manner?',
      pl: 'Czy klient zapewnia szkolenie nakazujące wykonawcy wykonywanie pracy w określony sposób?',
      de: 'Bietet der Auftraggeber Schulungen an, die dem Auftragnehmer eine bestimmte Arbeitsweise vorgeben?',
    },
    helpText: {
      en: 'Training in the client’s own methods signals behavioral control; independent contractors use their own methods. Adviser-verify.',
      pl: 'Szkolenie w metodach klienta wskazuje na kontrolę behawioralną; niezależni wykonawcy stosują własne metody. Do weryfikacji przez doradcę.',
      de: 'Schulung in den Methoden des Auftraggebers deutet auf Verhaltenskontrolle hin; Selbstständige nutzen eigene Methoden. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USFED-BEH-03',
    category: 'behavioral',
    prompt: {
      en: 'Does the client evaluate how the work is done rather than only the final result?',
      pl: 'Czy klient ocenia sposób wykonania pracy, a nie tylko końcowy rezultat?',
      de: 'Bewertet der Auftraggeber die Art der Arbeitsausführung und nicht nur das Endergebnis?',
    },
    helpText: {
      en: 'Evaluation systems measuring how (not just what) is delivered indicate an employment relationship. Adviser-verify.',
      pl: 'Systemy oceny mierzące sposób (a nie tylko wynik) dostawy wskazują na stosunek pracy. Do weryfikacji przez doradcę.',
      de: 'Bewertungssysteme, die das Wie (nicht nur das Was) messen, deuten auf ein Arbeitsverhältnis hin. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },

  // ----- Federal common-law: financial control (3) ------------------------
  {
    id: 'Q-USFED-FIN-01',
    category: 'financial',
    prompt: {
      en: 'Does the worker have a genuine opportunity for profit or loss, bearing significant unreimbursed business expenses?',
      pl: 'Czy wykonawca ma realną szansę na zysk lub stratę, ponosząc istotne niezwrócone koszty działalności?',
      de: 'Hat der Auftragnehmer eine echte Gewinn- oder Verlustchance und trägt erhebliche nicht erstattete Betriebskosten?',
    },
    helpText: {
      en: 'Financial control — real exposure to profit or loss and unreimbursed expenses points to an independent business. Adviser-verify.',
      pl: 'Kontrola finansowa — realna ekspozycja na zysk lub stratę i niezwrócone koszty wskazują na niezależną działalność. Do weryfikacji przez doradcę.',
      de: 'Finanzielle Kontrolle — echtes Gewinn-/Verlustrisiko und nicht erstattete Kosten sprechen für ein eigenständiges Unternehmen. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USFED-FIN-02',
    category: 'financial',
    prompt: {
      en: 'Does the worker make their services available to the wider market (multiple clients)?',
      pl: 'Czy wykonawca udostępnia swoje usługi szerszemu rynkowi (wielu klientom)?',
      de: 'Bietet der Auftragnehmer seine Dienstleistungen dem breiteren Markt (mehreren Auftraggebern) an?',
    },
    helpText: {
      en: 'Availability to the market is a self-employment indicator; exclusive engagement points the other way. Adviser-verify.',
      pl: 'Dostępność na rynku to wskaźnik samozatrudnienia; wyłączność wskazuje odwrotnie. Do weryfikacji przez doradcę.',
      de: 'Marktverfügbarkeit ist ein Selbstständigkeitsindiz; Exklusivität weist in die Gegenrichtung. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USFED-FIN-03',
    category: 'financial',
    prompt: {
      en: 'Is the worker paid a regular recurring wage or salary rather than a flat fee per project?',
      pl: 'Czy wykonawca otrzymuje regularne, powtarzalne wynagrodzenie zamiast stałej opłaty za projekt?',
      de: 'Wird der Auftragnehmer regelmäßig als Lohn/Gehalt statt pauschal pro Projekt vergütet?',
    },
    helpText: {
      en: 'A guaranteed recurring wage is characteristic of employment; project-based flat fees suggest a contractor. Adviser-verify.',
      pl: 'Gwarantowane, powtarzalne wynagrodzenie jest typowe dla zatrudnienia; opłaty za projekt sugerują wykonawcę. Do weryfikacji przez doradcę.',
      de: 'Ein garantiertes regelmäßiges Entgelt ist typisch für Beschäftigung; projektbezogene Pauschalen sprechen für einen Auftragnehmer. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },

  // ----- Federal common-law: relationship (3) -----------------------------
  {
    id: 'Q-USFED-REL-01',
    category: 'relationship',
    prompt: {
      en: 'Are the worker’s services a key, integral aspect of the client’s regular business?',
      pl: 'Czy usługi wykonawcy stanowią kluczowy, integralny element zwykłej działalności klienta?',
      de: 'Sind die Leistungen des Auftragnehmers ein wesentlicher, integraler Bestandteil des regulären Geschäfts des Auftraggebers?',
    },
    helpText: {
      en: 'Services integral to the core business weigh toward employment under the common-law relationship factor. Adviser-verify.',
      pl: 'Usługi integralne dla działalności podstawowej przeważają na rzecz zatrudnienia w ramach czynnika relacji. Do weryfikacji przez doradcę.',
      de: 'Für das Kerngeschäft wesentliche Leistungen sprechen beim Beziehungsfaktor für Beschäftigung. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USFED-REL-02',
    category: 'relationship',
    prompt: {
      en: 'Does a written agreement describe the relationship as an independent-contractor engagement?',
      pl: 'Czy pisemna umowa opisuje relację jako współpracę z niezależnym wykonawcą?',
      de: 'Beschreibt eine schriftliche Vereinbarung das Verhältnis als selbstständige Auftragsbeziehung?',
    },
    helpText: {
      en: 'A contractor-style written agreement is relevant but not decisive — substance controls over the label. Adviser-verify.',
      pl: 'Umowa w stylu wykonawcy jest istotna, lecz nie rozstrzygająca — liczy się treść, nie etykieta. Do weryfikacji przez doradcę.',
      de: 'Ein auftragnehmerartiger Vertrag ist relevant, aber nicht entscheidend — die Substanz geht der Bezeichnung vor. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-USFED-REL-03',
    category: 'relationship',
    prompt: {
      en: 'Does the worker receive employee-type benefits (insurance, pension, paid leave) from the client?',
      pl: 'Czy wykonawca otrzymuje od klienta świadczenia typu pracowniczego (ubezpieczenie, emerytura, płatny urlop)?',
      de: 'Erhält der Auftragnehmer vom Auftraggeber arbeitnehmertypische Leistungen (Versicherung, Rente, bezahlten Urlaub)?',
    },
    helpText: {
      en: 'Employee-style benefits strongly indicate an employment relationship. Adviser-verify.',
      pl: 'Świadczenia typu pracowniczego silnie wskazują na stosunek pracy. Do weryfikacji przez doradcę.',
      de: 'Arbeitnehmertypische Leistungen deuten stark auf ein Arbeitsverhältnis hin. Beraterprüfung erforderlich.',
    },
    citation: CITE_COMMON_LAW,
    adviserVerify: true,
    answerType: 'yes-no',
    required: false,
  },

  // ----- California AB5 "ABC" overlay (3 prongs) ---------------------------
  {
    id: 'Q-USAB5-A',
    category: 'ab5',
    prompt: {
      en: 'Prong A: Is the worker free from the control and direction of the hiring entity in performing the work, both under contract and in fact?',
      pl: 'Przesłanka A: Czy wykonawca jest wolny od kontroli i kierownictwa podmiotu zatrudniającego przy wykonywaniu pracy, zarówno umownie, jak i faktycznie?',
      de: 'Kriterium A: Ist der Auftragnehmer bei der Arbeitsausführung frei von Kontrolle und Weisung des Auftraggebers, sowohl vertraglich als auch tatsächlich?',
    },
    helpText: {
      en: 'AB5 ABC test prong A. All three prongs must pass for independent-contractor status in California; otherwise the worker defaults to employee. Adviser-verify — professional-services / B2B exemptions (§2776) are adviser-confirm, never automatic.',
      pl: 'Przesłanka A testu ABC (AB5). Wszystkie trzy przesłanki muszą być spełnione dla statusu niezależnego wykonawcy w Kalifornii; w przeciwnym razie domyślnie pracownik. Do weryfikacji przez doradcę — wyłączenia B2B (§2776) potwierdza doradca.',
      de: 'Kriterium A des ABC-Tests (AB5). Alle drei Kriterien müssen erfüllt sein, sonst gilt der Auftragnehmer in Kalifornien als Arbeitnehmer. Beraterprüfung — B2B-Ausnahmen (§2776) bestätigt der Berater, nie automatisch.',
    },
    citation: CITE_AB5,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USAB5-B',
    category: 'ab5',
    prompt: {
      en: 'Prong B: Does the worker perform work that is outside the usual course of the hiring entity’s business?',
      pl: 'Przesłanka B: Czy wykonawca wykonuje pracę wykraczającą poza zwykły zakres działalności podmiotu zatrudniającego?',
      de: 'Kriterium B: Verrichtet der Auftragnehmer Arbeiten außerhalb des üblichen Geschäftsbetriebs des Auftraggebers?',
    },
    helpText: {
      en: 'AB5 ABC test prong B — often the hardest to satisfy; work within the core business fails this prong. Adviser-verify.',
      pl: 'Przesłanka B testu ABC (AB5) — często najtrudniejsza do spełnienia; praca w ramach działalności podstawowej nie spełnia tej przesłanki. Do weryfikacji przez doradcę.',
      de: 'Kriterium B des ABC-Tests (AB5) — oft am schwersten zu erfüllen; Arbeit im Kerngeschäft erfüllt es nicht. Beraterprüfung erforderlich.',
    },
    citation: CITE_AB5,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },
  {
    id: 'Q-USAB5-C',
    category: 'ab5',
    prompt: {
      en: 'Prong C: Is the worker customarily engaged in an independently established trade, occupation, or business of the same nature as the work performed?',
      pl: 'Przesłanka C: Czy wykonawca zwyczajowo prowadzi niezależnie ustanowiony zawód, działalność lub przedsiębiorstwo tego samego rodzaju co wykonywana praca?',
      de: 'Kriterium C: Übt der Auftragnehmer gewöhnlich ein unabhängig etabliertes Gewerbe, einen Beruf oder ein Geschäft derselben Art wie die ausgeführte Arbeit aus?',
    },
    helpText: {
      en: 'AB5 ABC test prong C — an established independent business (own clients, licence, marketing) satisfies this prong. Adviser-verify.',
      pl: 'Przesłanka C testu ABC (AB5) — ustanowiona niezależna działalność (własni klienci, licencja, marketing) spełnia tę przesłankę. Do weryfikacji przez doradcę.',
      de: 'Kriterium C des ABC-Tests (AB5) — ein etabliertes unabhängiges Geschäft (eigene Kunden, Lizenz, Marketing) erfüllt es. Beraterprüfung erforderlich.',
    },
    citation: CITE_AB5_B2B,
    adviserVerify: true,
    answerType: 'yes-no',
    required: true,
  },

  // ----- §530 safe-harbor relief conditions (3) ---------------------------
  {
    id: 'Q-US530-01',
    category: 'section530',
    prompt: {
      en: 'Reporting consistency: has the business filed all required Forms 1099 for the worker on a basis consistent with treating them as a contractor?',
      pl: 'Spójność sprawozdawcza: czy firma złożyła wszystkie wymagane formularze 1099 dla wykonawcy w sposób spójny z traktowaniem go jako wykonawcy?',
      de: 'Meldekonsistenz: Hat das Unternehmen alle erforderlichen Formulare 1099 für den Auftragnehmer konsistent mit einer Auftragnehmerbehandlung eingereicht?',
    },
    helpText: {
      en: '§530 requires reporting consistency (all Forms 1099 filed). This is a relief-eligibility flag surfaced for adviser review — it never changes the classification verdict. Adviser-verify.',
      pl: '§530 wymaga spójności sprawozdawczej (wszystkie formularze 1099 złożone). To flaga kwalifikowalności do ulgi dla doradcy — nie zmienia werdyktu klasyfikacji. Do weryfikacji przez doradcę.',
      de: '§530 verlangt Meldekonsistenz (alle Formulare 1099 eingereicht). Dies ist ein Entlastungs-Kennzeichen für die Beraterprüfung — es ändert das Klassifizierungsurteil nie. Beraterprüfung erforderlich.',
    },
    citation: CITE_SECTION_530,
    adviserVerify: true,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-US530-02',
    category: 'section530',
    prompt: {
      en: 'Substantive consistency: has the business treated this worker and all similar workers as contractors (never as employees)?',
      pl: 'Spójność merytoryczna: czy firma traktowała tego wykonawcę i wszystkich podobnych wykonawców jako wykonawców (nigdy jako pracowników)?',
      de: 'Materielle Konsistenz: Hat das Unternehmen diesen und alle vergleichbaren Auftragnehmer stets als Auftragnehmer (nie als Arbeitnehmer) behandelt?',
    },
    helpText: {
      en: '§530 requires substantive consistency across similar workers. Relief-eligibility flag only — never a verdict change. Adviser-verify.',
      pl: '§530 wymaga spójności merytorycznej wśród podobnych wykonawców. Wyłącznie flaga kwalifikowalności do ulgi — nie zmienia werdyktu. Do weryfikacji przez doradcę.',
      de: '§530 verlangt materielle Konsistenz über vergleichbare Auftragnehmer. Nur Entlastungs-Kennzeichen — keine Urteilsänderung. Beraterprüfung erforderlich.',
    },
    citation: CITE_SECTION_530,
    adviserVerify: true,
    answerType: 'yes-no',
    required: false,
  },
  {
    id: 'Q-US530-03',
    category: 'section530',
    prompt: {
      en: 'Reasonable basis: did the business rely on a recognised safe harbor (judicial precedent, a prior IRS audit, or a long-standing industry practice)?',
      pl: 'Uzasadniona podstawa: czy firma oparła się na uznanej bezpiecznej przystani (precedens sądowy, wcześniejszy audyt IRS lub utrwalona praktyka branżowa)?',
      de: 'Vernünftige Grundlage: Stützte sich das Unternehmen auf einen anerkannten Safe Harbor (Rechtsprechung, frühere IRS-Prüfung oder langjährige Branchenpraxis)?',
    },
    helpText: {
      en: '§530 also asks for a reasonable basis. Surfaced as adviser context alongside the two consistency requirements; the reasonable-basis safe harbors are fact-specific. Adviser-verify.',
      pl: '§530 wymaga także uzasadnionej podstawy. Prezentowane jako kontekst dla doradcy obok dwóch wymogów spójności; bezpieczne przystanie są zależne od faktów. Do weryfikacji przez doradcę.',
      de: '§530 verlangt zudem eine vernünftige Grundlage. Als Beraterkontext neben den beiden Konsistenzanforderungen dargestellt; die Safe Harbors sind sachverhaltsabhängig. Beraterprüfung erforderlich.',
    },
    citation: CITE_SECTION_530,
    adviserVerify: true,
    answerType: 'yes-no',
    required: false,
  },
] as const satisfies readonly (UsQuestion & RuleSetQuestion)[];

/** Typed rule-set wrapper. */
export const US_RULE_SET: RuleSet = {
  profileId: 'us-classification',
  ruleSetVersion: RULE_SET_VERSION,
  countryCode: 'US',
  questions: US_QUESTIONS,
} as const;
