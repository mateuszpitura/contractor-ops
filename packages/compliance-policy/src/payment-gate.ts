import { parsePolicyRuleId } from './registry.js';
import type { PolicyRuleId } from './types.js';

export interface PaymentEligibilityItemReason {
  itemId: string;
  policyRuleId: string | null;
  documentTypeLabelKey: string;
  expiredOnDate?: string;
  jurisdictionTz: string;
  deepLinkPath: string;
}

export interface PaymentEligibilityContractorReason {
  contractorId: string;
  contractorName: string;
  reasons: PaymentEligibilityItemReason[];
}

export interface PaymentEligibilityResult {
  blocked: boolean;
  wouldBlock: boolean;
  contractorReasons: PaymentEligibilityContractorReason[];
}

export interface PaymentEligibilityBlockedItem {
  id: string;
  contractorId: string;
  policyRuleId: string | null;
  documentType: string;
  expiresAt: Date | null;
  expiryJurisdictionTz: string | null;
  contractor: {
    id: string;
    displayName: string;
    organizationId: string;
  };
}

export interface EvaluatePaymentEligibilityInput {
  items: PaymentEligibilityBlockedItem[];
  enforce: boolean;
}

/**
 * Pure policy evaluation — groups expired BLOCKING items into per-contractor
 * reasons and applies the enforcement flag. IO (DB fetch, audit log, TRPC
 * throw) stays in packages/api compliance-payment-gate.ts.
 */
export function evaluatePaymentEligibility(
  input: EvaluatePaymentEligibilityInput,
): PaymentEligibilityResult {
  const contractorReasons = groupPaymentBlockReasons(input.items);
  const blocked = input.enforce && contractorReasons.length > 0;
  const wouldBlock = !input.enforce && contractorReasons.length > 0;
  return { blocked, wouldBlock, contractorReasons };
}

export function groupPaymentBlockReasons(
  items: PaymentEligibilityBlockedItem[],
): PaymentEligibilityContractorReason[] {
  const grouped = new Map<string, PaymentEligibilityContractorReason>();
  for (const item of items) {
    let cr = grouped.get(item.contractorId);
    if (!cr) {
      cr = {
        contractorId: item.contractorId,
        contractorName: item.contractor.displayName,
        reasons: [],
      };
      grouped.set(item.contractorId, cr);
    }
    cr.reasons.push({
      itemId: item.id,
      policyRuleId: item.policyRuleId,
      documentTypeLabelKey: getDocumentTypeLabelKey(item.documentType, item.policyRuleId),
      ...(item.expiresAt ? { expiredOnDate: item.expiresAt.toISOString().slice(0, 10) } : {}),
      jurisdictionTz: item.expiryJurisdictionTz ?? 'UTC',
      deepLinkPath: `/contractors/${item.contractorId}/compliance#item-${item.id}`,
    });
  }
  return Array.from(grouped.values());
}

export function getDocumentTypeLabelKey(documentType: string, policyRuleId: string | null): string {
  if (policyRuleId) {
    const { stableNamespace } = parsePolicyRuleId(policyRuleId as PolicyRuleId);
    return `Compliance.documentType.compliance-policy-engine.${stableNamespace}`;
  }
  return `Compliance.documentType.compliance-policy-engine.${documentType.toLowerCase()}`;
}
