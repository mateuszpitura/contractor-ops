import type { PrismaClient } from '@contractor-ops/db';
import type { GcResult } from './types.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Phase 76 D-12 — 90-day retention GC.
 *
 * Deletes IdpChangeProvenance rows where initiatedAt < (now - 90 days).
 * Idempotent: a second call within an hour returns deleted: 0.
 *
 * Wired into the reminders cron handler (apps/cron-worker, Plan 76-10) — daily.
 */
export async function gcExpiredProvenance(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<GcResult> {
  const cutoff = new Date(now.getTime() - NINETY_DAYS_MS);
  const result = await db.idpChangeProvenance.deleteMany({
    where: { initiatedAt: { lt: cutoff } },
  });
  return { deleted: result.count };
}
