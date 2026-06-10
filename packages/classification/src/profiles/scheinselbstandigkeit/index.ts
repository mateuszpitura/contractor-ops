// ---------------------------------------------------------------------------
// Scheinselbständigkeit Profile — DE country implementation
// ---------------------------------------------------------------------------
//
// Registers itself on import. Scoring is server-only — never import this
// module in a client bundle.

import { registerProfile } from '../../registry.js';
import type { AnswerMap, Assessment, AssessmentShell } from '../../types/assessment.js';
import type { Outcome, OutcomeView } from '../../types/outcome.js';
import type { ClassificationProfile } from '../../types/profile.js';
import { RULE_SET_VERSION, SCHEIN_QUESTIONS } from './rule-set.js';
import { scoreSchein } from './scoring.js';

export class ScheinselbstandigkeitProfile implements ClassificationProfile {
  readonly profileId = 'scheinselbstandigkeit' as const;
  readonly country = 'DE' as const;
  readonly displayName = 'Scheinselbständigkeit (DE)';
  readonly ruleSetVersion = RULE_SET_VERSION;

  buildAssessment(_engagementId: string): AssessmentShell {
    return {
      ruleSetVersion: this.ruleSetVersion,
      profileId: this.profileId,
      questions: SCHEIN_QUESTIONS,
    };
  }

  scoreAssessment(answers: AnswerMap): Outcome {
    return scoreSchein(answers).outcome;
  }

  renderOutcome(assessment: Assessment): OutcomeView {
    const outcome = assessment.outcome;
    if (!outcome || outcome.kind !== 'SCHEINSELBSTANDIGKEIT') {
      throw new Error(
        'ScheinselbstandigkeitProfile.renderOutcome: expected SCHEINSELBSTANDIGKEIT outcome',
      );
    }
    return {
      kind: 'SCHEINSELBSTANDIGKEIT',
      verdict: outcome.verdict,
      summary: summariseOutcome(outcome),
    };
  }
}

function summariseOutcome(outcome: Extract<Outcome, { kind: 'SCHEINSELBSTANDIGKEIT' }>): string {
  switch (outcome.verdict) {
    case 'green':
      return `Niedriges Risiko (${outcome.totalScore.toFixed(1)}/100) — die Merkmale sprechen überwiegend für Selbstständigkeit.`;
    case 'amber':
      return `Mittleres Risiko (${outcome.totalScore.toFixed(1)}/100) — einzelne Scheinselbständigkeits-Indizien vorhanden.`;
    case 'red':
      return `Hohes Risiko (${outcome.totalScore.toFixed(1)}/100) — starke Indizien für Scheinselbständigkeit; Statusfeststellungsverfahren empfohlen.`;
  }
}

// Re-export for wizard UI and outcome page (single source of truth).
export {
  CATEGORY_TITLES,
  CATEGORY_WEIGHTS,
  RULE_SET_VERSION,
  SCHEIN_QUESTIONS,
  THRESHOLDS,
} from './rule-set.js';
export { billingRatioToScore, MissingAnswerError, scoreSchein } from './scoring.js';

// Side-effect registration.
registerProfile(new ScheinselbstandigkeitProfile());
