// Single const exported for snapshotting onto ClassificationAssessment.
// A test enforces this matches package.json's `version` field with a 'v' prefix.

export const POLICY_RULE_SET_VERSION = 'v6.0.0' as const;

export type PolicyRuleSetVersion = typeof POLICY_RULE_SET_VERSION;
