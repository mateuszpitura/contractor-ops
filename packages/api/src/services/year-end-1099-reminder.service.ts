// Year-end 1099-NEC batch-due reminder scan.
//
// NOTIFY-ONLY. This reminds staff that the 1099-NEC batch is due for the closing
// tax year — a human then reviews and files. It NEVER aggregates a batch, builds
// IRIS XML, renders a Copy-B, or transmits. Generation and filing are separate,
// deliberate, human-initiated staff actions (the review-before-file posture);
// the cron only nudges.
//
// Ships dark: the calling cron handler short-circuits when `module.us-expansion`
// is off, so nothing fires until US year-end filing is enabled.

import type { PrismaClient } from '@contractor-ops/db';
import { getRegionalClient, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';

import { dispatch } from './notification-service';
import { resolveRbacRecipients } from './rbac-recipients';

const log = createCronLogger('year-end-1099-reminder');

export interface YearEnd1099ReminderResult {
  taxYear: number;
  organizationsNotified: number;
  recipientsNotified: number;
}

/**
 * The tax year the reminder is for. Year-end 1099-NEC returns are furnished /
 * filed early in the following calendar year (Copy B by ~Jan 31), so the reminder
 * that runs in January targets the year that just closed.
 */
function reminderTaxYear(now: Date): number {
  return now.getUTCFullYear() - 1;
}

/**
 * Scan for organizations with US recipients on file (active W-9 submissions) and
 * send each org's staff a single per-tax-year reminder that the 1099-NEC batch is
 * due. Idempotent across runs: a stable per-tax-year dedup key means each staff
 * user is reminded once per tax year, not once per cron tick.
 */
export async function runYearEnd1099ReminderScan(
  now: Date = new Date(),
): Promise<YearEnd1099ReminderResult> {
  const total: YearEnd1099ReminderResult = {
    taxYear: reminderTaxYear(now),
    organizationsNotified: 0,
    recipientsNotified: 0,
  };

  for (const region of SUPPORTED_REGIONS) {
    let client: PrismaClient;
    try {
      client = getRegionalClient(region);
    } catch (err) {
      log.warn({ err, region }, 'year-end-1099-reminder: region client unavailable; skipping');
      continue;
    }

    const result = await runYearEnd1099ReminderScanForClient(client, now);
    total.organizationsNotified += result.organizationsNotified;
    total.recipientsNotified += result.recipientsNotified;
  }

  return total;
}

async function runYearEnd1099ReminderScanForClient(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<YearEnd1099ReminderResult> {
  const taxYear = reminderTaxYear(now);

  const orgRows = await client.taxFormSubmission.findMany({
    where: { formType: 'W9', status: 'ACTIVE' },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  let organizationsNotified = 0;
  let recipientsNotified = 0;

  for (const { organizationId } of orgRows) {
    try {
      const recipients = await resolveRbacRecipients(organizationId, 'contractor:read');
      if (recipients.length === 0) continue;

      await dispatch(
        {
          organizationId,
          type: 'tax.form_1099_year_end_reminder',
          recipientUserIds: recipients,
          title: `1099-NEC filing due for tax year ${taxYear}`,
          body: `The ${taxYear} 1099-NEC batch is due. Review recipients above the reporting threshold, generate the batch, and file with the IRS — nothing is generated or filed automatically. Confirm figures with your tax adviser before filing.`,
          entityType: 'ORGANIZATION',
          entityId: organizationId,
        },
        { outboxEventId: `form1099-year-end-reminder:${taxYear}` },
      );

      organizationsNotified += 1;
      recipientsNotified += recipients.length;
    } catch (err) {
      log.error({ err, organizationId, taxYear }, 'year-end 1099 reminder dispatch failed for org');
    }
  }

  return { taxYear, organizationsNotified, recipientsNotified };
}
