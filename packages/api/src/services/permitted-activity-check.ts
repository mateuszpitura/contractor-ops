// ---------------------------------------------------------------------------
// Phase 79 · GULF-03 (D-05..D-08) — Permitted-activity ISIC scope check + auto-NOC.
// ---------------------------------------------------------------------------
//
// When a contract is created for a free-zone contractor, compare the contract's
// activity ISIC codes against the contractor's FreeZoneAssignment permitted set.
// Deterministic set-overlap only (D-06) — NO fuzzy text matching, NO prefix logic,
// NO MANUAL_REVIEW tristate (D-08).
//
// Outcomes:
//   - Either side uncoded (empty code list) → SKIP (D-08). No code, no advisory,
//     no NOC. Symmetric: an uncoded contract OR an uncoded permitted set has
//     nothing deterministic to compare.
//   - Codes overlap → in-scope, no advisory.
//   - Zero overlap → fire a non-blocking advisory AND auto-create a WARNING NOC
//     (No-Objection Certificate) required-document item scoped to that engagement
//     (D-07). Contract creation still proceeds — this function never throws on a
//     mismatch; the caller (contract-create path, Plan 05) keeps going.
//
// documentType: the DocumentType enum carries no NOC value and Plan 02's schema
// landed generate-only (DB apply deferred), so this pure-logic plan does NOT add
// a new enum value / migration. The NOC item uses the generic `OTHER` document
// type and is disambiguated by `name` + `policyRuleId` (NOC_POLICY_RULE_ID).
//
// Architectural twin: free-zone-compliance.ts — same structural-client pattern so
// the item write + audit log compose inside or outside the contract-create $transaction.

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { AuditWriterClient } from './audit-writer';
import { writeAuditLog } from './audit-writer';

const log = createLogger({ service: 'permitted-activity-check' });

/**
 * The DocumentType enum has no NOC member; `OTHER` is the generic carrier. The
 * NOC item is identified by its `policyRuleId` + `name`, not its documentType.
 */
export const NOC_DOCUMENT_TYPE = 'OTHER' as const;
/** Marker distinguishing the auto-created scope-mismatch NOC from other OTHER items. */
export const NOC_POLICY_RULE_ID = 'uae.permitted_activity_noc@v1' as const;
const NOC_ITEM_NAME = 'No-Objection Certificate (NOC) — activity scope' as const;

/**
 * Structural client — works with both `ctx.db` (full PrismaClient) and a `tx`
 * from `$transaction`. Only the `create` write path is needed (the read of the
 * permitted/contract code sets happens at the call site, Plan 05). Mirrors
 * free-zone-compliance.ts FreeZoneComplianceClient + audit-writer.ts.
 */
export interface PermittedActivityClient extends AuditWriterClient {
  contractorComplianceItem: {
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<unknown>;
  };
}

export interface CheckPermittedActivityContext {
  organizationId: string;
  contractorId: string;
  /** The engagement the advisory + NOC are scoped to. */
  contractId: string;
  /** The contractor's FreeZoneAssignment permitted ISIC codes (D-05/D-06). */
  permittedActivityIsicCodes: string[];
  /** The contract's activity ISIC codes; empty = uncoded → skip (D-08). */
  contractActivityIsicCodes: string[];
  /** Actor for the audit trail (D-17); defaults to SYSTEM (auto-creation). */
  actorType?: 'USER' | 'SYSTEM';
  actorId?: string | null;
}

export type CheckPermittedActivityResult =
  | { skipped: true }
  | { mismatch: false }
  | { mismatch: true; nocItemCreated: true };

/**
 * Run the deterministic ISIC scope check for a contract against a contractor's
 * free-zone permitted set. Non-blocking: a mismatch creates the advisory NOC and
 * resolves — it never throws, so the contract-create path proceeds (D-07).
 */
export async function checkPermittedActivityScope(
  client: PermittedActivityClient,
  ctx: CheckPermittedActivityContext,
): Promise<CheckPermittedActivityResult> {
  const contractCodes = ctx.contractActivityIsicCodes;
  const permittedCodes = ctx.permittedActivityIsicCodes;

  // D-08 — uncoded on either side has nothing deterministic to compare → skip.
  // No advisory, no NOC, no tristate.
  if (contractCodes.length === 0 || permittedCodes.length === 0) {
    return { skipped: true };
  }

  // D-06 — exact set-membership overlap only. No fuzzy / prefix matching.
  const permittedSet = new Set(permittedCodes);
  const hasOverlap = contractCodes.some(code => permittedSet.has(code));

  if (hasOverlap) {
    return { mismatch: false };
  }

  // Zero overlap → non-blocking advisory + auto-NOC scoped to the engagement (D-07).
  await client.contractorComplianceItem.create({
    data: {
      organizationId: ctx.organizationId,
      contractorId: ctx.contractorId,
      contractId: ctx.contractId,
      documentType:
        NOC_DOCUMENT_TYPE as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
      name: NOC_ITEM_NAME,
      severity: 'WARNING', // D-07 — surfaced, not payment-blocking
      policyRuleId: NOC_POLICY_RULE_ID,
      status: 'MISSING' as Prisma.ContractorComplianceItemUncheckedCreateInput['status'],
    },
  });

  // D-17 — system-side auto-creation is a sensitive mutation; audit it on the
  // same client so the item + audit row commit atomically with contract create.
  await writeAuditLog({
    organizationId: ctx.organizationId,
    actorType: ctx.actorType ?? 'SYSTEM',
    actorId: ctx.actorId ?? null,
    action: 'gulf.permitted_activity.noc.create',
    resourceType: 'CONTRACT',
    resourceId: ctx.contractId,
    metadata: {
      contractorId: ctx.contractorId,
      policyRuleId: NOC_POLICY_RULE_ID,
      contractActivityIsicCodes: contractCodes,
      permittedActivityIsicCodes: permittedCodes,
    },
    tx: client,
  });

  log.info(
    { contractorId: ctx.contractorId, contractId: ctx.contractId },
    'permitted-activity scope mismatch — advisory NOC created',
  );

  return { mismatch: true, nocItemCreated: true };
}
