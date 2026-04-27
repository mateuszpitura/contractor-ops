// Phase 71 D-09 D-10 D-11 D-12 — Compliance row supersession + materialisation.
//
// Two pure-ish helpers (DB-accepting via structural client) used by:
//   1. classification.submit's outcome-change branch (Plan 71-04)
//   2. classification.recreateComplianceAssessment admin mutation (Plan 71-05)
//
// Architectural twin: packages/api/src/services/audit-writer.ts — same
// structural-client pattern lets the helpers run inside or outside a $transaction.
//
// CRITICAL: callers MUST invoke these inside a transaction context when row
// atomicity matters (i.e., outcome change → old rows WAIVED + new rows inserted
// must be all-or-nothing). The helpers themselves do NOT open a transaction.

import type { EngagementContext } from '@contractor-ops/compliance-policy';
import { resolvePolicyRules } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';

/**
 * Inline shape for the Outcome union — avoids a tight import on
 * `@contractor-ops/classification`'s `Outcome` type at build time. The
 * discriminator is `kind` (D-10 contract); other fields are not needed here.
 */
export type OutcomeShape = { kind: string } & Record<string, unknown>;

/**
 * Extracts the outcome's discriminator (the field that determines which policy
 * rule set applies). Decision: compare ONLY on this field — sub-field changes
 * within the same kind do NOT trigger row churn.
 */
export function extractOutcomeKind(outcome: unknown): string {
  if (!outcome || typeof outcome !== 'object') return '__unknown__';
  const o = outcome as { kind?: unknown; type?: unknown };
  if (typeof o.kind === 'string') return o.kind;
  if (typeof o.type === 'string') return o.type;
  return '__unknown__';
}

/**
 * Compares outcomes for materialisation-relevant equality. Returns true when
 * the resolved policy rule set would be identical for both outcomes.
 */
export function outcomesEqualForPolicyResolution(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  return extractOutcomeKind(a) === extractOutcomeKind(b);
}

/**
 * Structural client interface — works with both `ctx.db` (full PrismaClient)
 * and a `tx` from `$transaction(async (tx) => ...)`. Mirrors audit-writer.ts.
 */
export interface SupersessionClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
    updateMany: (args: Prisma.ContractorComplianceItemUpdateManyArgs) => Promise<unknown>;
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<unknown>;
  };
}

export interface MaterialiseContext {
  organizationId: string;
  contractorId: string;
  contractId: string | null;
  engagement: EngagementContext;
}

export interface SupersedeContext extends MaterialiseContext {
  reason: 'classification_outcome_change' | 'superseded_by_policy_version' | 'admin_correction';
}

/**
 * Materialise rows from the resolved policy rule set. Used on first
 * classification when no prior rows exist for the contractor.
 *
 * Caller MUST verify "no prior rows" before calling — this function does NOT
 * check (Plan 71-04 keeps the check in submit's branch).
 */
export async function materialiseFromPolicy(
  client: SupersessionClient,
  ctx: MaterialiseContext,
): Promise<{ inserted: number }> {
  const rules = resolvePolicyRules(ctx.engagement);
  let inserted = 0;
  for (const rule of rules) {
    await client.contractorComplianceItem.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: ctx.contractId,
        documentType:
          rule.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
        name: rule.displayName,
        severity: rule.severity,
        policyRuleId: rule.policyRuleId,
        expiryJurisdictionTz: rule.expiryJurisdictionTz,
        status: 'MISSING',
      },
    });
    inserted++;
  }
  return { inserted };
}

/**
 * Supersede existing non-WAIVED rows for a contractor and materialise the new
 * outcome's rule set. Carry forward `satisfiedByDocumentId` + `expiresAt` when
 * `documentType` matches between an old row and a new rule (D-12).
 *
 * Reason values (D-09/D-10):
 *   - 'classification_outcome_change' — submit detected a different outcome.kind
 *   - 'superseded_by_policy_version'  — policy rule set version bumped
 *   - 'admin_correction'              — admin invoked recompute mutation
 */
export async function supersedeAndMaterialise(
  client: SupersessionClient,
  ctx: SupersedeContext,
): Promise<{ waivedCount: number; insertedCount: number; carriedForwardCount: number }> {
  // 1. Fetch existing non-WAIVED rows
  const oldRows = (await client.contractorComplianceItem.findMany({
    where: { contractorId: ctx.contractorId, status: { not: 'WAIVED' } },
    select: {
      id: true,
      documentType: true,
      satisfiedByDocumentId: true,
      expiresAt: true,
      status: true,
    },
  })) as Array<{
    id: string;
    documentType: string;
    satisfiedByDocumentId: string | null;
    expiresAt: Date | null;
    status: string;
  }>;

  // 2. Mark every existing row WAIVED with the supplied reason
  let waivedCount = 0;
  if (oldRows.length > 0) {
    await client.contractorComplianceItem.updateMany({
      where: { id: { in: oldRows.map(r => r.id) } },
      data: {
        status: 'WAIVED',
        waivedReason:
          ctx.reason as Prisma.ContractorComplianceItemUpdateManyMutationInput['waivedReason'],
      },
    });
    waivedCount = oldRows.length;
  }

  // 3. Insert the new rule set, carrying forward when documentType matches
  const oldByDocType = new Map(oldRows.map(r => [r.documentType, r]));
  const newRules = resolvePolicyRules(ctx.engagement);
  let insertedCount = 0;
  let carriedForwardCount = 0;

  for (const rule of newRules) {
    const carryFrom = oldByDocType.get(rule.documentType);
    const carryDoc = carryFrom?.satisfiedByDocumentId ?? null;
    if (carryDoc !== null) carriedForwardCount++;
    await client.contractorComplianceItem.create({
      data: {
        organizationId: ctx.organizationId,
        contractorId: ctx.contractorId,
        contractId: ctx.contractId,
        documentType:
          rule.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
        name: rule.displayName,
        severity: rule.severity,
        policyRuleId: rule.policyRuleId,
        expiryJurisdictionTz: rule.expiryJurisdictionTz,
        status: carryDoc === null ? 'MISSING' : 'SATISFIED',
        satisfiedByDocumentId: carryDoc,
        expiresAt: carryFrom?.expiresAt ?? null,
      },
    });
    insertedCount++;
  }

  return { waivedCount, insertedCount, carriedForwardCount };
}
