// ---------------------------------------------------------------------------
// Classification Outcome Types — D-03
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
}

/** IR35 outcome — 5-area composite per D-13. */
export interface Ir35Outcome {
  readonly kind: 'IR35';
  readonly ruleSetVersion: string;
  readonly verdict: Ir35Verdict;
  readonly areas: readonly Ir35AreaResult[];
  readonly computedAt: string; // ISO-8601
}

/** DRV 4 categories for Scheinselbständigkeit. */
export type ScheinCategory = 'integration' | 'entrepreneurial' | 'personal-dep' | 'economic-dep';

/** Traffic-light verdicts per DRV thresholds (D-14). */
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

/** Scheinselbständigkeit outcome — weighted sum per D-14. */
export interface ScheinselbstandigkeitOutcome {
  readonly kind: 'SCHEINSELBSTANDIGKEIT';
  readonly ruleSetVersion: string;
  readonly verdict: ScheinVerdict; // overall green/amber/red
  readonly totalScore: number; // 0..100 scale
  readonly categories: readonly ScheinCategoryResult[];
  readonly computedAt: string; // ISO-8601
}

/** Discriminated union of all country outcomes. */
export type Outcome = Ir35Outcome | ScheinselbstandigkeitOutcome;

/** Minimal view passed to renderers (UI-side). */
export interface OutcomeView {
  readonly kind: Outcome['kind'];
  readonly verdict: Ir35Verdict | ScheinVerdict;
  readonly summary: string;
}
