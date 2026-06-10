// Public API for @contractor-ops/compliance-policy.
//
// Importing this module triggers registration of all baseline policy rules
// across jurisdiction sub-modules (uk/de/pl/us/ksa/uae) via module-import side
// effects. Order does not matter — each module registers its own rules.

import './policies/uk';
import './policies/de';
import './policies/pl';
import './policies/us';
import './policies/ksa';
import './policies/uae';

export {
  COMPLIANCE_DOC_REGISTRY,
  type ComplianceDocRegistryEntry,
  type ComplianceDocSeverity,
  clearComplianceDocs,
  complianceDocsForJurisdiction,
  getComplianceDoc,
  getComplianceDocRegistry,
  registerComplianceDoc,
} from './doc-registry';

export {
  daysUntilExpiryInTz,
  defaultExpiryFromUploadDate,
  isExpired,
  jurisdictionDate,
} from './expiry';
export {
  mapCountryCodeToJurisdiction,
  mapIsoToJurisdiction,
} from './jurisdiction-resolver';
export type {
  EvaluatePaymentEligibilityInput,
  PaymentEligibilityBlockedItem,
  PaymentEligibilityContractorReason,
  PaymentEligibilityItemReason,
  PaymentEligibilityResult,
} from './payment-gate';
export {
  evaluatePaymentEligibility,
  getDocumentTypeLabelKey,
  groupPaymentBlockReasons,
} from './payment-gate';
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
