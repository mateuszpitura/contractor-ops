// ---------------------------------------------------------------------------
// US Profile — federal common-law + CA AB5 + §530 country implementation
// ---------------------------------------------------------------------------
//
// Registers itself into the registry on import. Do NOT import this module in a
// client bundle — scoring must stay server-side.

import { registerProfile } from '../../registry.js';
import type { AnswerMap, Assessment, AssessmentShell } from '../../types/assessment.js';
import type { Outcome, OutcomeView } from '../../types/outcome.js';
import type { ClassificationProfile } from '../../types/profile.js';
import { RULE_SET_VERSION, US_QUESTIONS, US_WORK_STATE_CONTEXT_KEY } from './rule-set.js';
import { scoreUsClassification } from './scoring.js';

/**
 * Resolve the AB5 work state: the engagement work-state is the primary trigger,
 * falling back to the contractor's US state when the engagement work-state is
 * unset. AB5 governs work performed in California, not residence, so the
 * engagement location takes precedence.
 */
export function resolveUsWorkState(input: {
  assignmentWorkState?: string | null;
  contractorUsState?: string | null;
}): string | null {
  const assignment = input.assignmentWorkState?.trim();
  if (assignment) return assignment;
  const contractor = input.contractorUsState?.trim();
  return contractor ? contractor : null;
}

/** Inject a resolved work-state into an answer map under the reserved context key. */
export function withUsWorkState(answers: AnswerMap, workState: string | null): AnswerMap {
  if (!workState) return answers;
  return { ...answers, [US_WORK_STATE_CONTEXT_KEY]: { value: workState } };
}

export class UsClassificationProfile implements ClassificationProfile {
  readonly profileId = 'us-classification' as const;
  readonly country = 'US' as const;
  readonly displayName = 'US Worker Classification (federal + CA AB5 + §530)';
  readonly ruleSetVersion = RULE_SET_VERSION;

  buildAssessment(_engagementId: string): AssessmentShell {
    return {
      ruleSetVersion: this.ruleSetVersion,
      profileId: this.profileId,
      questions: US_QUESTIONS,
    };
  }

  scoreAssessment(answers: AnswerMap): Outcome {
    const workState = answers[US_WORK_STATE_CONTEXT_KEY]?.value;
    return scoreUsClassification(answers, {
      workState: typeof workState === 'string' ? workState : null,
    }).outcome;
  }

  renderOutcome(assessment: Assessment): OutcomeView {
    const outcome = assessment.outcome;
    if (!outcome || outcome.kind !== 'US_CLASSIFICATION') {
      throw new Error('UsClassificationProfile.renderOutcome: expected US_CLASSIFICATION outcome');
    }
    return {
      kind: 'US_CLASSIFICATION',
      verdict: outcome.verdict,
      summary: summariseOutcome(outcome),
    };
  }
}

function summariseOutcome(outcome: Extract<Outcome, { kind: 'US_CLASSIFICATION' }>): string {
  const relief = outcome.section530ReliefEligible
    ? ' §530 safe-harbor relief may be available — confirm with a US tax adviser.'
    : '';
  switch (outcome.verdict) {
    case 'employee':
      return `Likely employee — the engagement has the hallmarks of employment. Advisory decision-support only, not a legal determination.${relief}`;
    case 'independent-contractor':
      return `Likely independent contractor — consistent with an independently established business. Advisory decision-support only, not a legal determination.${relief}`;
    case 'indeterminate':
      return `Indeterminate — the available answers do not give a clear verdict; review with a US tax adviser. Advisory decision-support only, not a legal determination.${relief}`;
  }
}

// Re-export rule-set constants for the wizard UI + server callers.
export {
  RULE_SET_VERSION,
  US_QUESTIONS,
  US_RULE_SET,
  US_WORK_STATE_CONTEXT_KEY,
} from './rule-set.js';
export { scoreUsClassification } from './scoring.js';

// Side-effect registration: first import registers the profile.
registerProfile(new UsClassificationProfile());
