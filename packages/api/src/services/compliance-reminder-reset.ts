// Renewal-reset listener — invoked from classification/free-zone flows when a
// compliance item's expiresAt changes (renewal upload, free-zone write, admin
// reset). Lives outside `compliance-reminder-scan.ts` so `free-zone-compliance`
// can reset band state without importing the scan (which itself calls into
// free-zone re-evaluation — an import cycle otherwise).

import type { Prisma } from '@contractor-ops/db';
import { writeAuditLog } from './audit-writer';

export async function onComplianceItemExpiresAtChanged(
  tx: Prisma.TransactionClient,
  args: {
    itemId: string;
    organizationId: string;
    triggerEvent: 'expires_at_changed' | 'status_satisfied' | 'manual_admin_reset';
  },
): Promise<void> {
  const existing = await tx.contractorComplianceReminderState.findUnique({
    where: { itemId: args.itemId },
  });
  await tx.contractorComplianceReminderState.upsert({
    where: { itemId: args.itemId },
    update: {
      currentBand: 'NONE',
      lastBandFired: null,
      lastBandFiredAt: null,
      version: { increment: 1 },
    },
    create: {
      itemId: args.itemId,
      organizationId: args.organizationId,
      currentBand: 'NONE',
      version: 0,
    },
  });
  await writeAuditLog({
    organizationId: args.organizationId,
    actorType: 'SYSTEM',
    action: 'compliance.reminder.reset',
    resourceType: 'CONTRACTOR',
    resourceId: args.itemId,
    metadata: {
      previousBand: existing?.lastBandFired ?? null,
      triggerEvent: args.triggerEvent,
    },
    tx,
  });
}
