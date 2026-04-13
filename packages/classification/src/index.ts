// ---------------------------------------------------------------------------
// @contractor-ops/classification — Pluggable Classification Engine
// ---------------------------------------------------------------------------

// Profile registrations (side-effect imports — must run before the registry is consulted).
// IR35 (GB) and Scheinselbständigkeit (DE) register themselves on first load.
import './profiles/ir35/index.js';
import './profiles/scheinselbstandigkeit/index.js';

// Client-safe rule-set re-exports (Plan 04 wizard UI consumes these).
// NOTE: Scoring functions from profiles/*/scoring are NEVER re-exported
// here — they are server-only (Pitfall 2 / T-58-11). Client code that
// needs scoring calls `trpc.classification.submit` instead.
export {
  IR35_QUESTIONS,
  IR35_RULE_SET,
  IR35_YES_DIRECTION,
  RULE_SET_VERSION as IR35_RULE_SET_VERSION,
} from './profiles/ir35/rule-set.js';
export {
  CATEGORY_TITLES,
  CATEGORY_WEIGHTS,
  NOT_APPLICABLE_LABEL,
  SCHEIN_QUESTIONS,
  SCHEIN_RULE_SET,
  THRESHOLDS as SCHEIN_THRESHOLDS,
  RULE_SET_VERSION as SCHEIN_RULE_SET_VERSION,
} from './profiles/scheinselbstandigkeit/rule-set.js';

// Registry
export {
  clearProfiles,
  getProfile,
  getProfileForCountry,
  listProfiles,
  registerProfile,
} from './registry.js';
export {
  billingRatioSchema,
  getAnswerSchemaForType,
  likert5AnswerSchema,
  rationaleSchema,
  score03AnswerSchema,
  yesNoAnswerSchema,
} from './schemas/answers.js';
export type { OutcomeSchemaType } from './schemas/assessment.js';
// Schemas
export {
  ir35AreaResultSchema,
  ir35AreaSchema,
  ir35AreaVerdictSchema,
  ir35OutcomeSchema,
  ir35VerdictSchema,
  outcomeSchema,
  scheinCategoryResultSchema,
  scheinCategorySchema,
  scheinOutcomeSchema,
  scheinVerdictSchema,
} from './schemas/assessment.js';
// Snapshot helper
export { buildQuestionsSnapshot } from './snapshot.js';
// Types
export type {
  AnswerMap,
  AnswerValue,
  Assessment,
  AssessmentShell,
  AssessmentStatus,
  QuestionsSnapshot,
} from './types/assessment.js';
export type {
  Ir35Area,
  Ir35AreaResult,
  Ir35AreaVerdict,
  Ir35Outcome,
  Ir35Verdict,
  Outcome,
  OutcomeView,
  ScheinCategory,
  ScheinCategoryResult,
  ScheinselbstandigkeitOutcome,
  ScheinVerdict,
} from './types/outcome.js';
export type { ClassificationProfile } from './types/profile.js';
export type {
  AnswerType,
  LocalisedText,
  RuleSet,
  RuleSetQuestion,
} from './types/rule-set.js';
