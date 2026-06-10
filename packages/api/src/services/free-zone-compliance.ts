// ---------------------------------------------------------------------------
// Free-zone license → ContractorComplianceItem
// ---------------------------------------------------------------------------
//
// Writes the free-zone trade-license compliance row OUT-OF-BAND from the
// FreeZoneAssignment service (NOT the classification → resolvePolicyRules path).
// The existing reminder cascade + payment-block gate key off
// `severity='BLOCKING' AND status='EXPIRED'` (compliance-payment-gate.ts),
// so the only new backend work is materialising this row correctly and letting
// the status flip at the TZ boundary.
//
// Two invariants handled here:
//   - The zone !== 'MAINLAND' gate lives in THIS service write, not in the
//     policy `appliesIf` (EngagementContext has no zone field). A Mainland
//     (DED-licensed) assignment writes NO item and arms no gate.
//   - There is no background sweep that flips PENDING→EXPIRED. Status is
//     derived at write/re-evaluate time via the TZ-aware isExpired boundary,
//     mirroring how the reminder cascade derives its bands.
//
// Architectural twin: compliance-supersession.ts — same structural-client pattern
// so the item write + audit log compose inside or outside a $transaction.

import { isExpired } from '@contractor-ops/compliance-policy';
import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { AuditWriterClient } from './audit-writer';
import { writeAuditLog } from './audit-writer';

const log = createLogger({ service: 'free-zone-compliance' });

/** The policy rule id the gate + cascade select on (BLOCKING severity, @v2). */
export const FREE_ZONE_POLICY_RULE_ID = 'uae.free_zone_license@v2' as const;
const FREE_ZONE_DOCUMENT_TYPE = 'UAE_FREE_ZONE_LICENSE' as const;
const FREE_ZONE_TZ = 'Asia/Dubai' as const;
const MAINLAND_ZONE = 'MAINLAND' as const;

/**
 * Structural client — works with both `ctx.db` (full PrismaClient) and a `tx`
 * from `$transaction`. Loose `Promise<unknown>` returns avoid the deep-generic
 * instantiation the concrete client union triggers. Mirrors
 * compliance-supersession.ts SupersessionClient + audit-writer.ts.
 */
export interface FreeZoneComplianceClient extends AuditWriterClient {
  contractorComplianceItem: {
    findFirst: (args: Prisma.ContractorComplianceItemFindFirstArgs) => Promise<unknown>;
    create: (args: Prisma.ContractorComplianceItemCreateArgs) => Promise<unknown>;
    update: (args: Prisma.ContractorComplianceItemUpdateArgs) => Promise<unknown>;
  };
}

/** The FreeZoneAssignment fields this service needs (structural — not the full row). */
export interface FreeZoneAssignmentInput {
  organizationId: string;
  contractorId: string;
  /** UaeFreeZoneCode value; 'MAINLAND' assignments write no compliance item. */
  zone: string;
  licenseNumber: string;
  licenseExpiresAt: Date;
}

export interface WriteFreeZoneComplianceContext {
  assignment: FreeZoneAssignmentInput;
  /** Actor for the audit trail. */
  actorType?: 'USER' | 'SYSTEM';
  actorId?: string | null;
  /** Override for deterministic tests; defaults to new Date(). */
  now?: Date;
}

export interface WriteFreeZoneComplianceResult {
  written: boolean;
  itemId: string | null;
  status: 'PENDING' | 'EXPIRED' | null;
  reason?: 'MAINLAND';
}

type ComplianceItemRow = {
  id: string;
  status: string;
  expiresAt: Date | null;
};

/**
 * Derive the compliance status from the license expiry. There is NO background
 * sweep flipping PENDING→EXPIRED (Open Q2 resolution) — status is computed here
 * at write time via the same TZ-aware boundary the cascade uses.
 */
function deriveStatus(licenseExpiresAt: Date, now: Date): 'PENDING' | 'EXPIRED' {
  return isExpired(licenseExpiresAt, FREE_ZONE_TZ, now) ? 'EXPIRED' : 'PENDING';
}

/**
 * Write (or update) the free-zone trade-license `ContractorComplianceItem` for a
 * FreeZoneAssignment.
 *
 * - Mainland zone → returns `{ written: false, reason: 'MAINLAND' }`. No item,
 *   no gate. Mainland is recordable but a different licensing regime.
 * - Otherwise → upserts a BLOCKING item keyed on the @v2 policy rule, with
 *   `expiresAt = licenseExpiresAt` (drives the cascade band math) and
 *   `status` derived from `isExpired` (EXPIRED hard-blocks payment via the gate).
 *
 * Sensitive mutation: writes an AuditLog row via the same client so the
 * item + audit commit atomically inside the caller's transaction.
 */
export async function writeFreeZoneComplianceItem(
  client: FreeZoneComplianceClient,
  ctx: WriteFreeZoneComplianceContext,
): Promise<WriteFreeZoneComplianceResult> {
  const { assignment } = ctx;
  const now = ctx.now ?? new Date();

  // The zone narrowing lives HERE, not in appliesIf (EngagementContext has no zone field).
  if (assignment.zone === MAINLAND_ZONE) {
    return { written: false, itemId: null, status: null, reason: 'MAINLAND' };
  }

  const status = deriveStatus(assignment.licenseExpiresAt, now);

  const existing = (await client.contractorComplianceItem.findFirst({
    where: {
      organizationId: assignment.organizationId,
      contractorId: assignment.contractorId,
      policyRuleId: FREE_ZONE_POLICY_RULE_ID,
      status: { not: 'WAIVED' },
    },
    select: { id: true, status: true, expiresAt: true },
  })) as ComplianceItemRow | null;

  let itemId: string;
  let action: string;

  if (existing) {
    await client.contractorComplianceItem.update({
      where: { id: existing.id },
      data: {
        expiresAt: assignment.licenseExpiresAt,
        status: status as Prisma.ContractorComplianceItemUpdateInput['status'],
        severity: 'BLOCKING',
        expiryJurisdictionTz: FREE_ZONE_TZ,
      },
    });
    itemId = existing.id;
    action = 'gulf.free_zone.compliance_item.update';
  } else {
    const created = (await client.contractorComplianceItem.create({
      data: {
        organizationId: assignment.organizationId,
        contractorId: assignment.contractorId,
        contractId: null,
        documentType:
          FREE_ZONE_DOCUMENT_TYPE as Prisma.ContractorComplianceItemUncheckedCreateInput['documentType'],
        name: 'UAE Free-Zone Trade License',
        severity: 'BLOCKING',
        policyRuleId: FREE_ZONE_POLICY_RULE_ID,
        expiryJurisdictionTz: FREE_ZONE_TZ,
        expiresAt: assignment.licenseExpiresAt,
        status: status as Prisma.ContractorComplianceItemUncheckedCreateInput['status'],
      },
    })) as { id: string };
    itemId = created.id;
    action = 'gulf.free_zone.compliance_item.create';
  }

  // Free-zone item write is a sensitive mutation; audit it on the same client.
  await writeAuditLog({
    organizationId: assignment.organizationId,
    actorType: ctx.actorType ?? 'SYSTEM',
    actorId: ctx.actorId ?? null,
    action,
    resourceType: 'CONTRACTOR',
    resourceId: assignment.contractorId,
    metadata: {
      itemId,
      zone: assignment.zone,
      licenseNumber: assignment.licenseNumber,
      policyRuleId: FREE_ZONE_POLICY_RULE_ID,
      status,
      expiresAt: assignment.licenseExpiresAt.toISOString(),
    },
    tx: client,
  });

  log.info(
    { itemId, contractorId: assignment.contractorId, zone: assignment.zone, status },
    'free-zone compliance item written',
  );

  return { written: true, itemId, status };
}

/**
 * Re-evaluate an existing free-zone item's status, flipping PENDING→EXPIRED when
 * the TZ-aware boundary has crossed. Consumed by the region-aware reminder fan-out
 * so Gulf items transition by reusing isExpired, mirroring how the cascade derives
 * its bands at scan time.
 *
 * Returns the new status when it changed, or null when no transition was needed.
 */
export async function reEvaluateFreeZoneStatus(
  // Only `update` is used here — narrow the client so cron-context callers
  // (the reminder scan's ReminderScanClient, which has no findFirst/create)
  // qualify structurally without widening to the full FreeZoneComplianceClient.
  client: {
    contractorComplianceItem: Pick<FreeZoneComplianceClient['contractorComplianceItem'], 'update'>;
  },
  item: {
    id: string;
    status: string;
    expiresAt: Date | null;
    expiryJurisdictionTz?: string | null;
  },
  now: Date = new Date(),
): Promise<'EXPIRED' | null> {
  if (item.expiresAt === null || item.status === 'WAIVED' || item.status === 'SATISFIED') {
    return null;
  }
  const tz = item.expiryJurisdictionTz ?? FREE_ZONE_TZ;
  if (item.status === 'PENDING' && isExpired(item.expiresAt, tz, now)) {
    await client.contractorComplianceItem.update({
      where: { id: item.id },
      data: { status: 'EXPIRED' as Prisma.ContractorComplianceItemUpdateInput['status'] },
    });
    return 'EXPIRED';
  }
  return null;
}
