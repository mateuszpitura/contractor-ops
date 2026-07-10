/**
 * Document virus-scan reconcile.
 *
 * Every 5 minutes, finds `Document` rows stuck in `virusScanStatus` of
 * `PENDING` or `FAILED` longer than `STALE_AFTER_MS` and re-schedules the
 * async ClamAV pipeline. Covers the fire-and-forget gap in
 * `document.confirmUpload` where a pod crash mid-scan leaves a document
 * permanently undownloadable for non-uploaders.
 *
 * Idempotent: a row already `CLEAN`/`INFECTED` is excluded by the predicate.
 */

import { scheduleDocumentVirusScan } from '@contractor-ops/api/services/document-virus-scan';
import { prisma } from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const STALE_AFTER_MS = 10 * 60 * 1_000;
const BATCH_LIMIT = 100;

interface ReconcileResult {
  scanned: number;
  rescanned: number;
  rescanFailed: number;
}

async function runReconcile(log: Parameters<JobHandler>[0]['log']): Promise<ReconcileResult> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stuck = await prisma.document.findMany({
    where: {
      deletedAt: null,
      virusScanStatus: { in: ['PENDING', 'FAILED'] },
      updatedAt: { lt: cutoff },
      storageKey: { not: '' },
    },
    select: {
      id: true,
      storageKey: true,
      virusScanStatus: true,
    },
    take: BATCH_LIMIT,
    orderBy: { updatedAt: 'asc' },
  });

  if (stuck.length === 0) {
    return { scanned: 0, rescanned: 0, rescanFailed: 0 };
  }

  let rescanned = 0;
  let rescanFailed = 0;

  for (const row of stuck) {
    try {
      scheduleDocumentVirusScan(prisma, row.id, row.storageKey);
      rescanned += 1;
    } catch (err) {
      rescanFailed += 1;
      log.error(
        { err: err instanceof Error ? err.message : String(err), documentId: row.id },
        'failed to reschedule document virus scan',
      );
    }
  }

  return { scanned: stuck.length, rescanned, rescanFailed };
}

export const documentVirusScanReconcileHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const result = await runReconcile(ctx.log);
    ctx.log.info(result, 'document virus-scan reconcile tick complete');
    metrics.gauge('cron.document_virus_scan_reconcile.rescanned', result.rescanned);
    metrics.gauge('cron.document_virus_scan_reconcile.rescan_failed', result.rescanFailed);
    return {
      ok: result.rescanFailed === 0,
      durationMs: Math.round(performance.now() - start),
      details: { ...result } as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'document virus-scan reconcile tick failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'document-virus-scan-reconcile' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
