// ---------------------------------------------------------------------------
// IR35 Area Scoring — per-area verdicts
// ---------------------------------------------------------------------------
//
// Each of the 5 HMRC areas returns one of the 5 Ir35AreaVerdict values plus up
// to 3 driving question IDs. The composite-rule module (`scoring.ts`) then
// combines the 5 area verdicts into the overall Ir35Outcome per D-13.
//
// Algorithm:
//  1. Walk every question in the area.
//  2. Translate the answer (Yes/No, likert) into a directional signal using the
//     `IR35_YES_DIRECTION` map.
//  3. If any answer is a 'strong' signal → area verdict = 'strong-<direction>'.
//  4. Else count leaning signals: ≥2 leaning-inside and 0 leaning-outside →
//     'leaning-inside'; ≥2 leaning-outside and 0 leaning-inside → 'leaning-outside';
//     otherwise → 'neutral'.
//  5. `drivingQuestionIds` = up to 3 question IDs sorted by magnitude (strong > leaning),
//     break ties by declaration order.

import type { AnswerMap } from '../../types/assessment.js';
import type { Ir35Area, Ir35AreaVerdict } from '../../types/outcome.js';
import type { YesDirection } from './rule-set.js';
import { IR35_QUESTIONS, IR35_YES_DIRECTION } from './rule-set.js';

type AnsweredSignal = YesDirection;

/** Magnitude score for tie-breaking driver selection. */
const MAGNITUDE: Record<AnsweredSignal, number> = {
  'inside-strong': 3,
  'outside-strong': 3,
  'inside-leaning': 1,
  'outside-leaning': 1,
  neutral: 0,
};

function interpretAnswer(
  _questionId: string,
  rawValue: unknown,
  yesDirection: YesDirection,
): AnsweredSignal {
  // likert-5: scores 4-5 = Yes direction; 1-2 = opposite; 3 = neutral.
  if (typeof rawValue === 'number') {
    if (rawValue >= 4) return yesDirection;
    if (rawValue <= 2) return flip(yesDirection);
    return 'neutral';
  }
  // yes-no: 'yes' | 'no' | boolean true/false
  const isYes = rawValue === 'yes' || rawValue === true;
  const isNo = rawValue === 'no' || rawValue === false;
  if (isYes) return yesDirection;
  if (isNo) return flip(yesDirection);
  // unknown — treat as neutral (unanswered optional question)
  return 'neutral';
}

function flip(direction: YesDirection): YesDirection {
  switch (direction) {
    case 'outside-strong':
      return 'inside-leaning';
    case 'inside-strong':
      return 'outside-leaning';
    case 'outside-leaning':
      return 'inside-leaning';
    case 'inside-leaning':
      return 'outside-leaning';
    default:
      return 'neutral';
  }
}

export interface AreaScoreResult {
  readonly verdict: Ir35AreaVerdict;
  readonly drivingQuestionIds: readonly string[];
}

/** Derive the area verdict from collected non-neutral signals. */
function deriveVerdict(signals: ReadonlyArray<{ signal: AnsweredSignal }>): Ir35AreaVerdict {
  const hasStrongInside = signals.some(s => s.signal === 'inside-strong');
  if (hasStrongInside) return 'strong-inside';

  const hasStrongOutside = signals.some(s => s.signal === 'outside-strong');
  if (hasStrongOutside) return 'strong-outside';

  const leaningInside = signals.filter(s => s.signal === 'inside-leaning').length;
  const leaningOutside = signals.filter(s => s.signal === 'outside-leaning').length;
  if (leaningInside >= 2 && leaningOutside === 0) return 'leaning-inside';
  if (leaningOutside >= 2 && leaningInside === 0) return 'leaning-outside';
  return 'neutral';
}

/**
 * Score a single IR35 area from the raw answers.
 * Pure: no IO, no side effects. Safe to call server-side only.
 */
export function scoreIr35Area(area: Ir35Area, answers: AnswerMap): AreaScoreResult {
  const questions = IR35_QUESTIONS.filter(q => q.area === area);
  const signals: Array<{ id: string; signal: AnsweredSignal }> = [];

  for (const q of questions) {
    const entry = answers[q.id];
    if (!entry) continue;
    const yesDir = IR35_YES_DIRECTION[q.id] ?? 'neutral';
    // billing-ratio / rationale not used in IR35 yet; value fallback to rawScore.
    const rawValue = entry.value ?? entry.rawScore;
    const signal = interpretAnswer(q.id, rawValue, yesDir);
    if (signal !== 'neutral') {
      signals.push({ id: q.id, signal });
    }
  }

  const verdict = deriveVerdict(signals);

  // Drivers: top-3 by magnitude, ties broken by declaration order.
  const drivers = signals
    .slice()
    .sort((a, b) => MAGNITUDE[b.signal] - MAGNITUDE[a.signal])
    .slice(0, 3)
    .map(s => s.id);

  return { verdict, drivingQuestionIds: drivers };
}
