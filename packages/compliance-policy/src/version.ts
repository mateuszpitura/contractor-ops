// Phase 71 D-03 — Single const exported for snapshotting onto ClassificationAssessment.
// Test 71-01-04 enforces this matches package.json's `version` field with a 'v' prefix.

export const POLICY_RULE_SET_VERSION = 'v6.0.0' as const;

export type PolicyRuleSetVersion = typeof POLICY_RULE_SET_VERSION;
