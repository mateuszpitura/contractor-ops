// ---------------------------------------------------------------------------
// Classification Outcome Types
// ---------------------------------------------------------------------------
//
// Two country profiles produce two outcome shapes:
//  - IR35 (UK): 5-area per-area verdict (substitution, control, financial-risk,
//    part-and-parcel, moo) with an overall SDS determination.
//  - Scheinselbständigkeit (DE): 4-category weighted traffic-light (integration,
//    entrepreneurial, personal-dep, economic-dep) with DRV-aligned thresholds.
//
// A discriminated union on `kind` makes outcomes type-safe at every consumer.

/** IR35 five areas (per HMRC CEST + case law). */
export type Ir35Area = 'substitution' | 'control' | 'financial-risk' | 'part-and-parcel' | 'moo';

/** Per-area verdict for IR35 — 5-level gradient. */
export type Ir35AreaVerdict =
  | 'strong-outside'
  | 'leaning-outside'
  | 'neutral'
  | 'leaning-inside'
  | 'strong-inside';

/** Composite IR35 verdict ("Outside IR35", "Inside IR35", "Indeterminate"). */
export type Ir35Verdict = 'outside' | 'inside' | 'indeterminate';

/** Per-area result for IR35. */
export interface Ir35AreaResult {
  readonly area: Ir35Area;
  readonly verdict: Ir35AreaVerdict;
  readonly rationaleKey?: string;
  readonly caseLawCitations: readonly string[];
  /** Up to 3 question IDs that most drove this area's verdict. */
  readonly drivingQuestionIds?: readonly string[];
}

/** IR35 outcome — 5-area composite. */
export interface Ir35Outcome {
  readonly kind: 'IR35';
  readonly ruleSetVersion: string;
  readonly verdict: Ir35Verdict;
  readonly areas: readonly Ir35AreaResult[];
  readonly computedAt: string; // ISO-8601
}

/** DRV 4 categories for Scheinselbständigkeit. */
export type ScheinCategory = 'integration' | 'entrepreneurial' | 'personal-dep' | 'economic-dep';

/** Traffic-light verdicts per DRV thresholds. */
export type ScheinVerdict = 'green' | 'amber' | 'red';

/** Per-category result for DRV. */
export interface ScheinCategoryResult {
  readonly category: ScheinCategory;
  readonly weight: number; // 0..100, sums to 100 across all categories
  readonly rawScore: number; // 0..3 average of answered criteria (Nicht anwendbar excluded)
  readonly weightedScore: number; // rawScore × weight
  readonly verdict: ScheinVerdict;
  readonly drvReferences: readonly string[];
}

/** Scheinselbständigkeit outcome — weighted sum. */
export interface ScheinselbstandigkeitOutcome {
  readonly kind: 'SCHEINSELBSTANDIGKEIT';
  readonly ruleSetVersion: string;
  readonly verdict: ScheinVerdict; // overall green/amber/red
  readonly totalScore: number; // 0..100 scale
  readonly categories: readonly ScheinCategoryResult[];
  readonly computedAt: string; // ISO-8601
}

// --- US worker classification --------------------------------------------
//
// The federal IRS common-law three-category base (behavioral / financial /
// relationship) is combined with a dispositive CA-ABC (AB5) overlay when the
// work is performed in California, plus a §530 relief-eligibility flag. The
// output is advisory decision-support — never a final legal determination.

/** US question categories: the three federal common-law factors plus the CA-ABC overlay and §530 relief. */
export type UsQuestionCategory = 'behavioral' | 'financial' | 'relationship' | 'ab5' | 'section530';

/** The three federal IRS common-law factor groups. */
export type UsFederalCategory = 'behavioral' | 'financial' | 'relationship';

/** Advisory US verdict — never asserted as a legal determination. */
export type UsClassificationVerdict = 'employee' | 'independent-contractor' | 'indeterminate';

/** Per-factor tally for one federal common-law category. */
export interface UsFederalFactorResult {
  readonly category: UsFederalCategory;
  readonly employeeSignals: number;
  readonly contractorSignals: number;
}

/** US worker-classification outcome — federal common-law base + AB5 overlay + §530 flag. */
export interface UsClassificationOutcome {
  readonly kind: 'US_CLASSIFICATION';
  readonly ruleSetVersion: string;
  readonly verdict: UsClassificationVerdict;
  readonly federalFactors: readonly UsFederalFactorResult[];
  /** True when the CA-ABC overlay was applied (work performed in California). */
  readonly ab5Flag: boolean;
  /** §530 safe-harbor relief eligibility — a flag surfaced for adviser review, never a verdict change. */
  readonly section530ReliefEligible: boolean;
  readonly computedAt: string; // ISO-8601
}

/** Discriminated union of all country outcomes. */
export type Outcome = Ir35Outcome | ScheinselbstandigkeitOutcome | UsClassificationOutcome;

/** Minimal view passed to renderers (UI-side). */
export interface OutcomeView {
  readonly kind: Outcome['kind'];
  readonly verdict: Ir35Verdict | ScheinVerdict | UsClassificationVerdict;
  readonly summary: string;
}
