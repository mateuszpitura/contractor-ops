// LIKELY_MISSING verdict materialises a single open ContractorComplianceItem
// of severity WARNING for the contract's IP-assignment policy rule.
//
// NOTE: this does NOT reuse `materialiseFromPolicy`, which resolves and
// materialises the ENTIRE jurisdiction rule set (RTW, UTR, …). A health check
// that found a missing IP clause must create exactly ONE item — the IP rule —
// so we look up that single rule from the registry and create it directly,
// idempotently on (contractor, policyRuleId).

import { listPolicyRules } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import type { Jurisdiction } from '@contractor-ops/validators';

/** Per-jurisdiction IP policy rule id (DE is the Werkvertrag/Nutzungsrechte variant). */
export const JURISDICTION_TO_POLICY_RULE_ID: Record<Jurisdiction, string> = {
  UK: 'uk.ip_assignment@v1',
  DE: 'de.werkvertrag_ip@v1',
  PL: 'pl.ip_assignment@v1',
  US: 'us.ip_assignment@v1',
  KSA: 'ksa.ip_assignment@v1',
  UAE: 'uae.ip_assignment@v1',
};

/**
 * Structural client — works with both `ctx.db` and a `$transaction` tx.
 * Mirrors compliance-supersession.ts's SupersessionClient pattern.
 */
export interface MaterialiseClient {
  contractorComplianceItem: {
    findFirst: (args: Prisma.ContractorComplianceItemFindFirstArgs) => Promise<unknown>;
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<{ id: string }>;
  };
}

export interface MaterialiseLikelyMissingArgs {
  organizationId: string;
  contractorId: string;
  contractId: string;
  jurisdiction: Jurisdiction;
}

/**
 * Creates (or returns the existing) open ContractorComplianceItem for the
 * jurisdiction's IP-assignment policy rule. Idempotent on
 * (contractorId, policyRuleId) — a re-run with the same LIKELY_MISSING verdict
 * does not create a duplicate (idempotent on (contractorId, policyRuleId)).
 */
export async function materialiseLikelyMissing(
  client: MaterialiseClient,
  args: MaterialiseLikelyMissingArgs,
): Promise<{ contractorComplianceItemId: string }> {
  const policyRuleId = JURISDICTION_TO_POLICY_RULE_ID[args.jurisdiction];
  const rule = listPolicyRules().find(r => r.policyRuleId === policyRuleId);
  if (!rule) {
    throw new Error(`Phase 75 IP policy rule not registered: ${policyRuleId}`);
  }

  // Idempotency — reuse the open (non-WAIVED) item if it already exists.
  const existing = (await client.contractorComplianceItem.findFirst({
    where: {
      contractorId: args.contractorId,
      policyRuleId,
      status: { not: 'WAIVED' },
    },
    select: { id: true },
  })) as { id: string } | null;
  if (existing) {
    return { contractorComplianceItemId: existing.id };
  }

  const created = await client.contractorComplianceItem.create({
    data: {
      organizationId: args.organizationId,
      contractorId: args.contractorId,
      contractId: args.contractId,
      name: rule.displayName,
      documentType:
        rule.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
      severity: rule.severity,
      policyRuleId,
      expiryJurisdictionTz: rule.expiryJurisdictionTz,
      // IP-assignment presence does not expire — present-or-not.
      expiresAt: null,
      status: 'MISSING',
    },
    select: { id: true },
  });
  return { contractorComplianceItemId: created.id };
}
