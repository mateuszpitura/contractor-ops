// ---------------------------------------------------------------------------
// Questions Snapshot Helper — D-08
// ---------------------------------------------------------------------------
//
// On submit, we persist a deep-frozen copy of the rule-set questions so that
// historical assessments always re-render with the exact wording shown to the
// user. Uses structuredClone + Object.freeze (RESEARCH §Pattern 4).

import type { QuestionsSnapshot } from './types/assessment.js';
import type { ClassificationProfile } from './types/profile.js';
import type { RuleSet } from './types/rule-set.js';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;

  for (const key of Object.keys(value as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = (value as any)[key];
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

/**
 * Build a deep-frozen snapshot of the profile's questions. The source rule set
 * can be mutated afterwards without affecting the snapshot (structuredClone).
 */
export function buildQuestionsSnapshot(
  profile: Pick<ClassificationProfile, 'profileId' | 'ruleSetVersion'>,
  ruleSet: RuleSet,
): QuestionsSnapshot {
  const snapshot: QuestionsSnapshot = {
    ruleSetVersion: profile.ruleSetVersion,
    profileId: profile.profileId,
    questions: structuredClone(ruleSet.questions) as QuestionsSnapshot['questions'],
  };
  return deepFreeze(snapshot);
}
