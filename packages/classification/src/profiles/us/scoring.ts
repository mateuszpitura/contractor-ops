// ---------------------------------------------------------------------------
// US Worker-Classification Scoring
// ---------------------------------------------------------------------------
//
// ORDER IS LOAD-BEARING:
//   1. Compute the federal IRS common-law composite (behavioral / financial /
//      relationship) — the base test. This is NOT the DOL 2024 economic-reality
//      rule, which is under active rulemaking and surfaces only as adviser
//      context.
//   2. When the work is performed in California, the AB5 "ABC" overlay is
//      DISPOSITIVE: the worker defaults to employee unless all three ABC prongs
//      pass, regardless of the federal composite.
//   3. §530 safe-harbor relief is a separate eligibility FLAG — it is surfaced
//      for adviser review and never changes the verdict.
//
// The output is advisory decision-support, never a final legal determination.
// This function is pure and server-only — no DB IO, never import from a client
// bundle.

import type { AnswerMap } from '../../types/assessment.js';
import type {
  UsClassificationOutcome,
  UsClassificationVerdict,
  UsFederalCategory,
  UsFederalFactorResult,
} from '../../types/outcome.js';
import type { UsYesDirection } from './rule-set.js';
import {
  RULE_SET_VERSION,
  US_AB5_PRONG_IDS,
  US_FEDERAL_YES_DIRECTION,
  US_SECTION_530_CONSISTENCY_IDS,
  US_SECTION_530_IDS,
} from './rule-set.js';

/** Context resolved server-side (never client-asserted) and fed into scoring. */
export interface UsScoringContext {
  /** ISO 3166-2 US state where the work is performed — drives the AB5 overlay. */
  readonly workState?: string | null;
}

export interface ScoreUsClassificationResult {
  readonly outcome: UsClassificationOutcome;
  readonly reasoning: string;
}

const FEDERAL_CATEGORIES: readonly UsFederalCategory[] = [
  'behavioral',
  'financial',
  'relationship',
];

/** Which federal category a question ID belongs to, derived from its ID prefix. */
function federalCategoryOf(questionId: string): UsFederalCategory | undefined {
  if (questionId.startsWith('Q-USFED-BEH-')) return 'behavioral';
  if (questionId.startsWith('Q-USFED-FIN-')) return 'financial';
  if (questionId.startsWith('Q-USFED-REL-')) return 'relationship';
  return;
}

/** A "yes" pushes in the mapped direction; a "no" pushes the opposite way. */
function signalDirection(
  answer: 'yes' | 'no',
  yesDirection: UsYesDirection,
): 'employee' | 'contractor' {
  if (answer === 'yes') return yesDirection;
  return yesDirection === 'employee' ? 'contractor' : 'employee';
}

interface FederalTally {
  readonly factors: readonly UsFederalFactorResult[];
  readonly employeeSignals: number;
  readonly contractorSignals: number;
}

function computeFederal(answers: AnswerMap): FederalTally {
  const employee: Record<UsFederalCategory, number> = {
    behavioral: 0,
    financial: 0,
    relationship: 0,
  };
  const contractor: Record<UsFederalCategory, number> = {
    behavioral: 0,
    financial: 0,
    relationship: 0,
  };

  for (const [questionId, yesDirection] of Object.entries(US_FEDERAL_YES_DIRECTION)) {
    const raw = answers[questionId]?.value;
    if (raw !== 'yes' && raw !== 'no') continue;
    const category = federalCategoryOf(questionId);
    if (!category) continue;
    if (signalDirection(raw, yesDirection) === 'employee') employee[category] += 1;
    else contractor[category] += 1;
  }

  const factors = FEDERAL_CATEGORIES.map(category => ({
    category,
    employeeSignals: employee[category],
    contractorSignals: contractor[category],
  }));
  const employeeSignals = factors.reduce((sum, f) => sum + f.employeeSignals, 0);
  const contractorSignals = factors.reduce((sum, f) => sum + f.contractorSignals, 0);
  return { factors, employeeSignals, contractorSignals };
}

/** §530 relief eligibility — both consistency requirements met and no answered condition failing. */
function computeSection530(answers: AnswerMap): boolean {
  const consistencyMet = US_SECTION_530_CONSISTENCY_IDS.every(id => answers[id]?.value === 'yes');
  if (!consistencyMet) return false;
  return US_SECTION_530_IDS.every(id => {
    const raw = answers[id]?.value;
    return raw === undefined || raw === 'yes';
  });
}

function isCalifornia(workState: string | null | undefined): boolean {
  return (workState ?? '').trim().toUpperCase() === 'CA';
}

function federalVerdict(tally: FederalTally): UsClassificationVerdict {
  if (tally.employeeSignals > tally.contractorSignals) return 'employee';
  if (tally.contractorSignals > tally.employeeSignals) return 'independent-contractor';
  return 'indeterminate';
}

const ADVISORY_NOTE = 'Advisory decision-support — not a legal determination (adviser-verify).';

/**
 * Pure US worker-classification scoring. Returns the outcome plus a
 * human-readable reasoning string that cites the triggering rule verbatim so
 * the outcome can be rendered for audit defence.
 */
export function scoreUsClassification(
  answers: AnswerMap,
  context: UsScoringContext = {},
): ScoreUsClassificationResult {
  const federal = computeFederal(answers);
  const section530ReliefEligible = computeSection530(answers);
  const ab5Flag = isCalifornia(context.workState);

  let verdict: UsClassificationVerdict;
  let reasoning: string;

  if (ab5Flag) {
    const allProngsPass = US_AB5_PRONG_IDS.every(id => answers[id]?.value === 'yes');
    verdict = allProngsPass ? 'independent-contractor' : 'employee';
    reasoning = allProngsPass
      ? `California work state: all three AB5 ABC prongs (CA Labor Code §2775) are satisfied → independent contractor. ${ADVISORY_NOTE}`
      : `California work state: the AB5 ABC test (CA Labor Code §2775) is dispositive — not all three ABC prongs are satisfied, so the worker defaults to employee. ${ADVISORY_NOTE}`;
  } else {
    verdict = federalVerdict(federal);
    reasoning = `Federal IRS common-law composite (behavioral / financial / relationship): ${federal.employeeSignals} employee signal(s) vs ${federal.contractorSignals} contractor signal(s) → ${verdict}. ${ADVISORY_NOTE}`;
  }

  const outcome: UsClassificationOutcome = {
    kind: 'US_CLASSIFICATION',
    ruleSetVersion: RULE_SET_VERSION,
    verdict,
    federalFactors: federal.factors,
    ab5Flag,
    section530ReliefEligible,
    computedAt: new Date().toISOString(),
  };

  return { outcome, reasoning };
}
