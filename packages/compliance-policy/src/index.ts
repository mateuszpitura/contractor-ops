// Phase 71 — public API for @contractor-ops/compliance-policy.

export { isExpired } from './expiry.js';

export {
  listPolicyRules,
  parsePolicyRuleId,
  registerPolicyRule,
  resolvePolicyRules,
} from './registry.js';
export type {
  EngagementContext,
  Jurisdiction,
  ParsedPolicyRuleId,
  PolicyRule,
  PolicyRuleId,
  Severity,
} from './types.js';
export { POLICY_RULE_SET_VERSION, type PolicyRuleSetVersion } from './version.js';
