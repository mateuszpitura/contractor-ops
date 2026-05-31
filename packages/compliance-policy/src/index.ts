// Phase 71 — public API for @contractor-ops/compliance-policy.
//
// Importing this module triggers registration of all 13 baseline policy rules
// across 5 jurisdiction sub-modules (uk/de/pl/ksa/uae) via module-import side
// effects. Order does not matter — each module registers its own rules.

import './policies/uk';
import './policies/de';
import './policies/pl';
import './policies/us';
import './policies/ksa';
import './policies/uae';

export { daysUntilExpiryInTz, isExpired, jurisdictionDate } from './expiry';

export {
  listPolicyRules,
  parsePolicyRuleId,
  registerPolicyRule,
  resolvePolicyRules,
} from './registry';
export type {
  EngagementContext,
  Jurisdiction,
  ParsedPolicyRuleId,
  PolicyRule,
  PolicyRuleId,
  Severity,
} from './types';
export { POLICY_RULE_SET_VERSION, type PolicyRuleSetVersion } from './version';
