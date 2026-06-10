// ---------------------------------------------------------------------------
// Classification Assessment Types
// ---------------------------------------------------------------------------

import type { Outcome } from './outcome.js';
import type { RuleSetQuestion } from './rule-set.js';

/** Persisted assessment status (matches ClassificationAssessmentStatus Prisma enum). */
export type AssessmentStatus = 'draft' | 'completed';

/** Per-question answer payload. `value` is type-checked at the Zod boundary. */
export interface AnswerValue {
  readonly rawScore?: 0 | 1 | 2 | 3;
  readonly value?: unknown;
  readonly isNotApplicable?: boolean;
}

/** Map of questionId → answer. */
export type AnswerMap = Record<string, AnswerValue>;

/**
 * Frozen snapshot of the rule-set questions as captured on submit.
 * Immutability guarantees the past assessment always re-renders with the exact
 * wording the user saw, even after the rule set is upgraded.
 */
export interface QuestionsSnapshot {
  readonly ruleSetVersion: string;
  readonly profileId: string;
  readonly questions: readonly RuleSetQuestion[];
}

/** Shell returned from ClassificationProfile.buildAssessment — no DB IO yet. */
export interface AssessmentShell {
  readonly ruleSetVersion: string;
  readonly profileId: string;
  readonly questions: readonly RuleSetQuestion[];
}

/**
 * Full assessment record (matches ClassificationAssessment Prisma model).
 * `questionsSnapshot`/`outcome`/`completedAt`/`immutableAfter`/`disclaimerAcknowledgedAt`
 * are populated on `submit`.
 */
export interface Assessment {
  readonly id: string;
  readonly organizationId: string;
  readonly contractorAssignmentId: string;
  readonly countryCode: string;
  readonly ruleSetVersion: string;
  readonly status: AssessmentStatus;
  readonly questionsSnapshot: QuestionsSnapshot | null;
  readonly answers: AnswerMap;
  readonly outcome: Outcome | null;
  readonly completedAt: Date | null;
  readonly disclaimerAcknowledgedAt: Date | null;
  readonly immutableAfter: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
