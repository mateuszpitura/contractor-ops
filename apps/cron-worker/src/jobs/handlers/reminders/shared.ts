/**
 * Date + dedup helpers shared across the reminders handler and its
 * sub-jobs (currently only `drv-clearance-expiries`).
 *
 * Ported 1:1 from apps/web/src/app/api/cron/reminders/reminders-shared.ts.
 */

import { prisma } from '@contractor-ops/db';

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Atomically claims a dedupe slot for a cron notification. Returns false
 * when another tick already claimed the same key (unique-constraint violation).
 */
export async function claimCronNotificationDedup(dedupeKey: string): Promise<boolean> {
  try {
    await prisma.notificationCronDedup.create({ data: { dedupeKey } });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return false;
    throw err;
  }
}
