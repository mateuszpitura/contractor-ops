// ---------------------------------------------------------------------------
// ClassificationProfile Interface — D-02
// ---------------------------------------------------------------------------
//
// Each country profile (IR35 / Scheinselbständigkeit) implements this
// interface and registers itself via `registerProfile` on import. Scoring
// MUST stay server-side (per Pitfall 2) — never import this module in a
// client bundle.

import type { AnswerMap, Assessment, AssessmentShell } from './assessment.js';
import type { Outcome, OutcomeView } from './outcome.js';

export interface ClassificationProfile {
  /** Unique profile identifier (e.g., "ir35", "scheinselbstandigkeit"). */
  readonly profileId: string;
  /** ISO 3166-1 alpha-2 country code (e.g., "GB", "DE"). */
  readonly country: string;
  /** Human-readable name (e.g., "IR35 (United Kingdom)"). */
  readonly displayName: string;
  /** Semver of the rule set — snapshotted on submit per D-08. */
  readonly ruleSetVersion: string;

  /** Produce a fresh (empty) assessment shell scoped to a single engagement. */
  buildAssessment(engagementId: string): AssessmentShell;

  /** Pure: score the answer map against this rule set's version. Server-only. */
  scoreAssessment(answers: AnswerMap): Outcome;

  /** Produce a UI-friendly view of a completed assessment. */
  renderOutcome(assessment: Assessment): OutcomeView;
}
