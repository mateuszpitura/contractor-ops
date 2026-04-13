// ---------------------------------------------------------------------------
// @contractor-ops/classification — Pluggable Classification Engine
// ---------------------------------------------------------------------------

// biome-ignore lint/performance/noBarrelFile: package entry point

// Profile registrations (side-effect imports — must run before the registry is consulted).
// IR35 (GB) and Scheinselbständigkeit (DE) register themselves on first load.
import './profiles/ir35/index.js';
import './profiles/scheinselbstandigkeit/index.js';

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
