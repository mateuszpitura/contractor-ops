// Phase 71 — public API for @contractor-ops/compliance-policy.
//
// Importing this module triggers registration of all 13 baseline policy rules
// across 5 jurisdiction sub-modules (uk/de/pl/ksa/uae) via module-import side
// effects. Order does not matter — each module registers its own rules.

import './policies/uk.js';
import './policies/de.js';
import './policies/pl.js';
import './policies/ksa.js';
import './policies/uae.js';

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
