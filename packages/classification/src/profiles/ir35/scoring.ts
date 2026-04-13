// ---------------------------------------------------------------------------
// IR35 Composite-Rule Scoring — D-13
// ---------------------------------------------------------------------------
//
// ORDER IS LOAD-BEARING. Dispositive rules FIRST (the 2024 Supreme Court PGMOL
// ruling + 2022 Atholl House ruling establish the precedence):
//   1. areas.substitution === 'strong-inside' OR areas.moo === 'strong-inside' → inside
//   2. areas.substitution === 'strong-outside' → outside
// Then composite:
//   count leaning-inside (incl strong-inside), leaning-outside (incl strong-outside)
//   ≥3 leaning-inside → inside
//   ≥3 leaning-outside → outside
//   ≥2 neutral critical (substitution + moo) → indeterminate
//   else → indeterminate
//
// This code is server-only: never import from a client bundle.

import type { AnswerMap } from '../../types/assessment.js';
import type {
  Ir35Area,
  Ir35AreaResult,
  Ir35AreaVerdict,
  Ir35Outcome,
  Ir35Verdict,
} from '../../types/outcome.js';
import { scoreIr35Area } from './area-scoring.js';
import { IR35_QUESTIONS, RULE_SET_VERSION } from './rule-set.js';

const AREAS_ORDERED: readonly Ir35Area[] = [
  'substitution',
  'control',
  'financial-risk',
  'part-and-parcel',
  'moo',
];

const CRITICAL_AREAS: readonly Ir35Area[] = ['substitution', 'moo'];

function isInsideSignal(v: Ir35AreaVerdict): boolean {
  return v === 'strong-inside' || v === 'leaning-inside';
}

function isOutsideSignal(v: Ir35AreaVerdict): boolean {
  return v === 'strong-outside' || v === 'leaning-outside';
}

function citationsForArea(area: Ir35Area): readonly string[] {
  const set = new Set<string>();
  for (const q of IR35_QUESTIONS) {
    if (q.area === area && q.caseLawCitation) set.add(q.caseLawCitation);
  }
  return Array.from(set);
}

function rationaleKey(verdict: Ir35Verdict, trigger: string): string {
  return `${verdict}.${trigger}`;
}

export interface ScoreIr35Result {
  readonly outcome: Ir35Outcome;
  readonly reasoning: string;
}

/**
 * Pure scoring function. Returns the full Ir35Outcome + a human-readable
 * reasoning string. The reasoning MUST cite the triggering rule so the outcome
 * page can render it verbatim for audit defence.
 */
export function scoreIr35(answers: AnswerMap): ScoreIr35Result {
  // Step 1: score each area.
  const areaMap = new Map<Ir35Area, Ir35AreaResult>();
  for (const area of AREAS_ORDERED) {
    const { verdict, drivingQuestionIds } = scoreIr35Area(area, answers);
    areaMap.set(area, {
      area,
      verdict,
      caseLawCitations: citationsForArea(area),
      drivingQuestionIds,
    });
  }

  const subVerdict = areaMap.get('substitution')?.verdict;
  const mooVerdict = areaMap.get('moo')?.verdict;

  let overall: Ir35Verdict;
  let reasoning: string;
  let triggerKey: string;

  // Step 2: DISPOSITIVE rules, ORDER LOAD-BEARING (D-13).
  if (subVerdict === 'strong-inside' || mooVerdict === 'strong-inside') {
    overall = 'inside';
    triggerKey = 'dispositive-inside';
    reasoning =
      subVerdict === 'strong-inside'
        ? 'Inside IR35 — Substitution strong-inside is dispositive per HMRC v Atholl House [2022] UKSC.'
        : 'Inside IR35 — Mutuality of Obligation strong-inside is dispositive per HMRC v PGMOL [2024] UKSC.';
  } else if (subVerdict === 'strong-outside') {
    overall = 'outside';
    triggerKey = 'dispositive-outside';
    reasoning =
      'Outside IR35 — Substitution strong-outside is dispositive per HMRC v Atholl House [2022] UKSC.';
  } else {
    // Step 3: composite count.
    let insideCount = 0;
    let outsideCount = 0;
    let neutralCriticalCount = 0;
    for (const area of AREAS_ORDERED) {
      const areaEntry = areaMap.get(area);
      if (!areaEntry) continue;
      const v = areaEntry.verdict;
      if (isInsideSignal(v)) insideCount += 1;
      if (isOutsideSignal(v)) outsideCount += 1;
      if (CRITICAL_AREAS.includes(area) && v === 'neutral') neutralCriticalCount += 1;
    }

    // Composite count takes precedence over the "neutral-critical" guard —
    // if the broader 5-area gradient is clearly one-sided (≥3), that's the
    // determining signal even when both critical areas happen to be neutral.
    if (insideCount >= 3) {
      overall = 'inside';
      triggerKey = 'composite-inside';
      reasoning = `Inside IR35 — ${insideCount} of 5 areas lean inside.`;
    } else if (outsideCount >= 3) {
      overall = 'outside';
      triggerKey = 'composite-outside';
      reasoning = `Outside IR35 — ${outsideCount} of 5 areas lean outside.`;
    } else if (neutralCriticalCount >= 2) {
      overall = 'indeterminate';
      triggerKey = 'neutral-critical';
      reasoning =
        'Indeterminate — both Substitution and MOO are neutral; insufficient signal to determine status.';
    } else {
      overall = 'indeterminate';
      triggerKey = 'composite-mixed';
      reasoning = `Indeterminate — ${insideCount} inside-leaning, ${outsideCount} outside-leaning; insufficient concentration of signals.`;
    }
  }

  const areas: Ir35AreaResult[] = AREAS_ORDERED.map(area => {
    const base = areaMap.get(area);
    if (!base) {
      // Unreachable: we populated every area in the loop above.
      throw new Error(`scoreIr35: missing area result for ${area}`);
    }
    return { ...base, rationaleKey: rationaleKey(overall, triggerKey) };
  });

  const outcome: Ir35Outcome = {
    kind: 'IR35',
    ruleSetVersion: RULE_SET_VERSION,
    verdict: overall,
    areas,
    computedAt: new Date().toISOString(),
  };

  return { outcome, reasoning };
}
