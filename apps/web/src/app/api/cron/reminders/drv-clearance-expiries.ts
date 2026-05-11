import { dispatch } from '@contractor-ops/api/services/notification-service';
import { resolveRbacRecipients } from '@contractor-ops/api/services/rbac-recipients';
import { prismaRaw } from '@contractor-ops/db';

import { addDays, claimCronNotificationDedup, startOfDay } from './reminders-shared';

// ---------------------------------------------------------------------------
// Phase 60 · CLASS-09 — DRV § 7a SGB IV clearance expiry detector.
// See .planning/phases/60-classification-polish/60-03-PLAN.md (D-11).
//
// Piggybacks on this existing reminders cron (NOT a new cron) to fire
// notifications 90 / 30 / 7 days before validTo on Statusfeststellungsverfahren
// rows with outcome in {SELBSTANDIG, ABHANGIG}. Day-exact match on
// (gte target, lt target+1) avoids timezone drift. One-shot dedup keyed on
// (type, entityType=CONTRACTOR, entityId=clearance.id) per T-60-12.
// ---------------------------------------------------------------------------

const DRV_EXPIRY_BANDS = [
  { days: 90, type: 'classification.drv_expiry_90d' as const },
  { days: 30, type: 'classification.drv_expiry_30d' as const },
  { days: 7, type: 'classification.drv_expiry_7d' as const },
];

export async function detectDrvClearanceExpiries(): Promise<number> {
  const now = new Date();
  const today = startOfDay(now);
  let notified = 0;

  for (const band of DRV_EXPIRY_BANDS) {
    const target = addDays(today, band.days);
    const targetEnd = addDays(target, 1);

    const clearances = await prismaRaw.statusfeststellungsverfahren.findMany({
      where: {
        validTo: { gte: target, lt: targetEnd },
        outcome: { in: ['SELBSTANDIG', 'ABHANGIG'] },
      },
    });

    for (const clearance of clearances) {
      const dedupeKey = `${band.type}:STATUSFEST:${clearance.id}`;
      if (!(await claimCronNotificationDedup(dedupeKey))) {
        continue;
      }

      const recipientUserIds = await resolveRbacRecipients(
        clearance.organizationId,
        'contractor:read',
      );
      if (recipientUserIds.length === 0) continue;

      const validToIso = clearance.validTo ? clearance.validTo.toISOString().slice(0, 10) : '';

      await dispatch({
        organizationId: clearance.organizationId,
        type: band.type,
        recipientUserIds,
        title: `DRV clearance expires in ${band.days} days`,
        body: `Reference ${clearance.drvReference}, valid until ${validToIso}. Begin the renewal filing — DRV processing typically takes 3-6 months.`,
        entityType: 'CONTRACTOR',
        entityId: clearance.id,
      });
      notified++;
    }
  }

  return notified;
}
