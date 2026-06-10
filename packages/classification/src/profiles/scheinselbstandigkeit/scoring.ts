// ---------------------------------------------------------------------------
// Scheinselbständigkeit (DRV) Scoring
// ---------------------------------------------------------------------------
//
// Pure function. For each category:
//   sumRaw = Σ rawScore (0..3)  — Nicht anwendbar (rawScore=0, isNotApplicable=true) still counted
//   maxRaw = criterionCount × 3
//   weightedScore = maxRaw === 0 ? 0 : (sumRaw / maxRaw) × categoryWeight
//
// totalScore = Σ weightedScore (0..100 scale).
// verdict (riskLevel):
//   totalScore < THRESHOLDS.green → 'green'
//   totalScore ≤ THRESHOLDS.amber → 'amber'
//   totalScore > THRESHOLDS.amber → 'red'
//
// Boundary tests (scoring.test.ts): 29.9→green, 30→amber, 60→amber, 60.1→red.
//
// DRV-ECO-01 billing-ratio is a 0..100 integer percentage (§ 2 Nr 9 SGB VI).
// Zod enforces integer input (z.number().int()), so '< 84' ≡ '<= 83' and
// matches the wording "> 83% → 3". Boundary tests: 50→1, 70→2, 83→2, 84→3.

import type { AnswerMap } from '../../types/assessment.js';
import type {
  ScheinCategory,
  ScheinCategoryResult,
  ScheinselbstandigkeitOutcome,
  ScheinVerdict,
} from '../../types/outcome.js';
import { CATEGORY_WEIGHTS, RULE_SET_VERSION, SCHEIN_QUESTIONS, THRESHOLDS } from './rule-set.js';

const CATEGORIES_ORDERED: readonly ScheinCategory[] = [
  'integration',
  'entrepreneurial',
  'personal-dep',
  'economic-dep',
];

/**
 * Billing-ratio bands per §2 Nr 9 SGB VI: Zod enforces integer input
 * (z.number().int()), so '< 84' ≡ '<= 83'. Boundary tests: 50→1, 70→2, 83→2, 84→3.
 */
export function billingRatioToScore(ratio: number): 0 | 1 | 2 | 3 {
  if (ratio < 50) return 0;
  if (ratio < 70) return 1;
  if (ratio < 84) return 2;
  return 3;
}

/**
 * Error thrown when a required DRV criterion is absent from the answer map.
 * A missing answer is distinct from "Nicht anwendbar": missing blocks submit;
 * Nicht anwendbar is a valid answered-zero.
 */
export class MissingAnswerError extends Error {
  readonly questionId: string;

  constructor(questionId: string) {
    super(`scoreSchein: missing required answer for questionId=${questionId}`);
    this.name = 'MissingAnswerError';
    this.questionId = questionId;
  }
}

function driftSafeVerdict(total: number): ScheinVerdict {
  if (total < THRESHOLDS.green) return 'green';
  if (total <= THRESHOLDS.amber) return 'amber';
  return 'red';
}

function drvReferencesForCategory(category: ScheinCategory): readonly string[] {
  const set = new Set<string>();
  for (const q of SCHEIN_QUESTIONS) {
    if (q.category === category && q.drvReference) set.add(q.drvReference);
  }
  return Array.from(set);
}

export interface ScoreScheinResult {
  readonly outcome: ScheinselbstandigkeitOutcome;
}

/**
 * Pure scoring function for Scheinselbständigkeit. Throws MissingAnswerError
 * when any required criterion is absent — callers must catch and surface to
 * the user ("please answer all required questions"). Nicht anwendbar with
 * rawScore=0 and isNotApplicable=true is a valid answered-zero.
 */
export function scoreSchein(answers: AnswerMap): ScoreScheinResult {
  // 1. Validate presence.
  for (const q of SCHEIN_QUESTIONS) {
    if (q.required && !(q.id in answers)) {
      throw new MissingAnswerError(q.id);
    }
  }

  // 2. Per-category aggregation.
  const categoryResults: ScheinCategoryResult[] = [];
  for (const category of CATEGORIES_ORDERED) {
    const questionsInCategory = SCHEIN_QUESTIONS.filter(q => q.category === category);
    const weight = CATEGORY_WEIGHTS[category];

    let sumRaw = 0;
    let count = 0;

    for (const q of questionsInCategory) {
      const entry = answers[q.id];
      if (!entry) continue; // optional criteria only — required already validated.
      let rawScore: number;
      if (q.id === 'DRV-ECO-01') {
        const value = typeof entry.value === 'number' ? entry.value : 0;
        rawScore = billingRatioToScore(value);
      } else {
        rawScore = entry.rawScore ?? 0;
      }
      sumRaw += rawScore;
      count += 1;
    }

    const maxRaw = count * 3;
    const weightedScore = maxRaw === 0 ? 0 : (sumRaw / maxRaw) * weight;
    const averageRaw = maxRaw === 0 ? 0 : sumRaw / count;

    const categoryVerdict: ScheinVerdict =
      weightedScore < weight * (THRESHOLDS.green / 100)
        ? 'green'
        : weightedScore <= weight * (THRESHOLDS.amber / 100)
          ? 'amber'
          : 'red';

    categoryResults.push({
      category,
      weight,
      rawScore: averageRaw,
      weightedScore,
      verdict: categoryVerdict,
      drvReferences: drvReferencesForCategory(category),
    });
  }

  // 3. Total + overall verdict.
  const totalScore = categoryResults.reduce((acc, c) => acc + c.weightedScore, 0);
  const overall = driftSafeVerdict(totalScore);

  const outcome: ScheinselbstandigkeitOutcome = {
    kind: 'SCHEINSELBSTANDIGKEIT',
    ruleSetVersion: RULE_SET_VERSION,
    verdict: overall,
    totalScore,
    categories: categoryResults,
    computedAt: new Date().toISOString(),
  };

  return { outcome };
}
