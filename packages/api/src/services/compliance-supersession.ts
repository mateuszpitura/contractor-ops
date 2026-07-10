// Compliance row supersession + materialisation.
//
// Two pure-ish helpers (DB-accepting via structural client) used by:
//   1. classification.submit's outcome-change branch
//   2. classification.recreateComplianceAssessment admin mutation
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
 * discriminator is `kind`; other fields are not needed here.
 */
export type OutcomeShape = { kind: string } & Record<string, unknown>;

/**
 * Extracts the outcome kind discriminator (e.g. `IR35`). For policy resolution
 * and supersession equality use `buildEngagementOutcome` / `outcomesEqualForPolicyResolution`.
 */
export function extractOutcomeKind(outcome: unknown): string {
  if (!outcome || typeof outcome !== 'object') return '__unknown__';
  const o = outcome as { kind?: unknown; type?: unknown };
  if (typeof o.kind === 'string') return o.kind;
  if (typeof o.type === 'string') return o.type;
  return '__unknown__';
}

/**
 * Maps a scored outcome to the EngagementContext.outcome discriminator used
 * by resolvePolicyRules (e.g. IR35 inside → `IR35-INSIDE`).
 */
export function buildEngagementOutcome(outcome: unknown): string {
  if (!outcome || typeof outcome !== 'object') return '__unknown__';
  const o = outcome as { kind?: unknown; type?: unknown; verdict?: unknown };
  const kind = extractOutcomeKind(outcome);
  if (kind === 'IR35' && typeof o.verdict === 'string') {
    return `IR35-${o.verdict.toUpperCase()}`;
  }
  return kind;
}

/**
 * Compares outcomes for materialisation-relevant equality. Returns true when
 * the resolved policy rule set would be identical for both outcomes.
 */
export function outcomesEqualForPolicyResolution(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  return buildEngagementOutcome(a) === buildEngagementOutcome(b);
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
  reason: 'CLASSIFICATION_OUTCOME_CHANGE' | 'SUPERSEDED_BY_POLICY_VERSION' | 'admin_correction';
}

/**
 * Materialise rows from the resolved policy rule set. Used on first
 * classification when no prior rows exist for the contractor.
 *
 * Caller MUST verify "no prior rows" before calling — this function does NOT
 * check (caller is responsible for verifying "no prior rows" in its branch).
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
 * `documentType` matches between an old row and a new rule.
 *
 * Reason values:
 *   - 'classification_outcome_change' — submit detected a different outcome.kind
 *   - 'superseded_by_policy_version'  — policy rule set version bumped
 *   - 'admin_correction'              — admin invoked recompute mutation
 */
export async function supersedeAndMaterialise(
  client: SupersessionClient,
  ctx: SupersedeContext,
): Promise<{ waivedCount: number; insertedCount: number; carriedForwardCount: number }> {
  const newRules = resolvePolicyRules(ctx.engagement);
  const newDocTypes = newRules.map(
    r => r.documentType as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
  );

  // 1. Fetch existing non-WAIVED rows scoped to this contract (when set) and
  // only document types present in the new rule set — avoids waiving sibling
  // contracts' items or unrelated types on contractor-wide recomputes.
  //
  // EXCLUDE out-of-band advisory rows from the supersession scope. Two families
  // are written OUTSIDE resolvePolicyRules and keyed off domain state, NOT the
  // classification outcome, so an unrelated classification recompute would
  // otherwise WAIVE them silently:
  //   - free-zone license items (uae.free_zone_license@v2) — written by the
  //     FreeZoneAssignment service; WAIVING them orphans the payment-block gate.
  //   - permitted-activity NOC advisories (uae.permitted_activity_noc@v1) —
  //     written by the contract-create scope check (permitted-activity-check.ts);
  //     WAIVING them erases the scope-mismatch advisory the UI links to, even when
  //     the recompute is for a different engagement (the findMany scopes on
  //     contractorId only).
  // The NOT-startsWith filters keep both out of the WAIVE set and the
  // carry-forward map.
  const oldRows = (await client.contractorComplianceItem.findMany({
    where: {
      contractorId: ctx.contractorId,
      contractId: ctx.contractId,
      documentType: { in: newDocTypes },
      status: { not: 'WAIVED' },
      NOT: [
        { policyRuleId: { startsWith: 'uae.free_zone' } },
        { policyRuleId: { startsWith: 'uae.permitted_activity_noc' } },
      ],
    },
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
  let insertedCount = 0;
  let carriedForwardCount = 0;

  for (const rule of newRules) {
    const carryFrom = oldByDocType.get(rule.documentType);
    const carryDoc = carryFrom?.satisfiedByDocumentId ?? null;
    const carryStatus = carryFrom?.status;
    const carryExpiresAt = carryFrom?.expiresAt ?? null;
    const now = new Date();
    const carryExpired =
      carryStatus === 'EXPIRED' ||
      (carryExpiresAt !== null && carryExpiresAt.getTime() <= now.getTime());
    const canCarrySatisfied = carryDoc !== null && !carryExpired && carryStatus !== 'EXPIRED';
    if (canCarrySatisfied) carriedForwardCount++;
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
        status: canCarrySatisfied ? 'SATISFIED' : 'MISSING',
        satisfiedByDocumentId: canCarrySatisfied ? carryDoc : null,
        expiresAt: canCarrySatisfied ? carryExpiresAt : null,
      },
    });
    insertedCount++;
  }

  return { waivedCount, insertedCount, carriedForwardCount };
}
