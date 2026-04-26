// ---------------------------------------------------------------------------
// IR35 Profile — UK country implementation (D-02)
// ---------------------------------------------------------------------------
//
// Registers itself into the registry on import (CLASS-01). Do NOT import this
// module in a client bundle — scoring MUST stay server-side per Pitfall 2.

import { registerProfile } from '../../registry.js';
import type { AnswerMap, Assessment, AssessmentShell } from '../../types/assessment.js';
import type { Outcome, OutcomeView } from '../../types/outcome.js';
import type { ClassificationProfile } from '../../types/profile.js';
import { IR35_QUESTIONS, RULE_SET_VERSION } from './rule-set.js';
import { scoreIr35 } from './scoring.js';

export class IR35Profile implements ClassificationProfile {
  readonly profileId = 'ir35' as const;
  readonly country = 'GB' as const;
  readonly displayName = 'IR35 (United Kingdom)';
  readonly ruleSetVersion = RULE_SET_VERSION;

  buildAssessment(_engagementId: string): AssessmentShell {
    return {
      ruleSetVersion: this.ruleSetVersion,
      profileId: this.profileId,
      questions: IR35_QUESTIONS,
    };
  }

  scoreAssessment(answers: AnswerMap): Outcome {
    return scoreIr35(answers).outcome;
  }

  renderOutcome(assessment: Assessment): OutcomeView {
    const outcome = assessment.outcome;
    if (!outcome || outcome.kind !== 'IR35') {
      throw new Error('IR35Profile.renderOutcome: expected IR35 outcome');
    }
    const summary = summariseOutcome(outcome);
    return {
      kind: 'IR35',
      verdict: outcome.verdict,
      summary,
    };
  }
}

function summariseOutcome(outcome: Extract<Outcome, { kind: 'IR35' }>): string {
  switch (outcome.verdict) {
    case 'inside':
      return 'Inside IR35 — the engagement has the hallmarks of employment for tax purposes.';
    case 'outside':
      return 'Outside IR35 — the engagement is consistent with self-employment.';
    case 'indeterminate':
      return 'Indeterminate — the available answers do not give a clear verdict; review with a tax adviser.';
  }
}

// Re-export rule-set constants for downstream plans (Plan 04 wizard).
export { IR35_QUESTIONS, RULE_SET_VERSION } from './rule-set.js';
export { scoreIr35 } from './scoring.js';

// Side-effect registration (CLASS-01): first import registers the profile.
registerProfile(new IR35Profile());
