/**
 * Data retention purge handler.
 *
 * Daily 03:00 UTC sweep: permanently deletes soft-deleted records older
 * than RETENTION_DAYS plus the associated R2 files for purged documents.
 *
 * Delete order matters — children before parents to respect FK constraints:
 *   1. R2 files for documents (BEFORE DB rows — retry-safe if R2 fails)
 *   2. DocumentLinks
 *   3. InvoiceFiles
 *   4. Documents
 *   5. Invoices
 *   6. Contracts
 *   7. Contractors
 *
 * Plus two ephemeral table sweeps (OAuthChallenge, PendingUpload) that
 * self-expire via `expiresAt`. Each ephemeral sweep is independent — one
 * failing does not abort the other.
 *
 * F-SCALE-07 — explicit tx timeout/maxWait so a wedged purge never
 * starves other tenants' cron mutations on the Neon HTTP driver.
 */

import { prisma } from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const RETENTION_DAYS = 90;

async function purgeR2Files(
  docs: Array<{ id: string; storageKey: string | null }>,
  log: Parameters<JobHandler>[0]['log'],
): Promise<{ failedR2DocIds: Set<string>; r2Deleted: number; skippedNoKey: number }> {
  const failedR2DocIds = new Set<string>();
  let r2Deleted = 0;
  let skippedNoKey = 0;

  if (docs.length === 0) return { failedR2DocIds, r2Deleted, skippedNoKey };

  const { deleteObject } = await import('@contractor-ops/api/services/r2');

  for (const doc of docs) {
    if (!doc.storageKey) {
      skippedNoKey++;
      continue;
    }
    try {
      await deleteObject(doc.storageKey);
      r2Deleted++;
    } catch (err) {
      log.warn(
        { storageKey: doc.storageKey, documentId: doc.id, err },
        'failed to delete R2 object — excluding from DB purge',
      );
      failedR2DocIds.add(doc.id);
    }
  }

  return { failedR2DocIds, r2Deleted, skippedNoKey };
}

export const dataPurgeHandler: JobHandler = async ctx => {
  const start = performance.now();

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const results: Record<string, number> = {};

    // 1. Snapshot the documents to purge so R2 cleanup + DB deletion
    //    operate on the exact same set (no race between query + delete).
    const expiredDocs = await prisma.document.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, storageKey: true },
    });
    const docIds = expiredDocs.map(d => d.id);

    // 2. R2 cleanup before DB — DB rows still reference the keys for retry.
    const { failedR2DocIds, r2Deleted, skippedNoKey } = await purgeR2Files(expiredDocs, ctx.log);
    if (skippedNoKey > 0) {
      ctx.log.info(
        { count: skippedNoKey },
        'documents with null storageKey skipped during R2 cleanup',
      );
    }
    results.r2Files = r2Deleted;
    results.purgeSkippedR2KeyMissing = skippedNoKey;

    const safeDocIds = docIds.filter(id => !failedR2DocIds.has(id));

    // 3. DB deletion in a single tx (children → parents).
    const txResults = await prisma.$transaction(
      async tx => {
        const txRes: Record<string, number> = {
          documentLinks: 0,
          invoiceFiles: 0,
          documents: 0,
        };

        if (safeDocIds.length > 0) {
          const linkResult = await tx.documentLink.deleteMany({
            where: { documentId: { in: safeDocIds } },
          });
          txRes.documentLinks = linkResult.count;

          const invoiceFileResult = await tx.invoiceFile.deleteMany({
            where: { documentId: { in: safeDocIds } },
          });
          txRes.invoiceFiles = invoiceFileResult.count;

          const docResult = await tx.document.deleteMany({
            where: { id: { in: safeDocIds } },
          });
          txRes.documents = docResult.count;
        }

        const invResult = await tx.invoice.deleteMany({
          where: { deletedAt: { not: null, lt: cutoff } },
        });
        txRes.invoices = invResult.count;

        const contractResult = await tx.contract.deleteMany({
          where: { deletedAt: { not: null, lt: cutoff } },
        });
        txRes.contracts = contractResult.count;

        const contractorResult = await tx.contractor.deleteMany({
          where: { deletedAt: { not: null, lt: cutoff } },
        });
        txRes.contractors = contractorResult.count;

        return txRes;
      },
      { timeout: 30_000, maxWait: 5_000 },
    );

    Object.assign(results, txResults);

    // 4. Ephemeral tables — each sweep wrapped independently so one
    //    failure doesn't abort the other.
    try {
      const { purgeExpiredOAuthChallenges } = await import(
        '@contractor-ops/api/services/oauth-challenge'
      );
      const oauthPurged = await purgeExpiredOAuthChallenges(prisma);
      results.oauthChallenges = oauthPurged;
      metrics.gauge('cron.data_purge.oauth_challenges', oauthPurged);
      ctx.log.info({ count: oauthPurged }, 'expired oauth challenges purged');
    } catch (err) {
      ctx.log.error({ err }, 'failed to purge expired oauth challenges');
      Sentry.captureException(err, {
        tags: { 'cron.job': 'data-purge', 'purge.target': 'oauth_challenges' },
      });
      results.oauthChallenges = 0;
    }

    try {
      const { purgeExpiredPendingUploads } = await import(
        '@contractor-ops/api/services/pending-upload'
      );
      const pendingPurged = await purgeExpiredPendingUploads(prisma);
      results.pendingUploads = pendingPurged;
      metrics.gauge('cron.data_purge.pending_uploads', pendingPurged);
      ctx.log.info({ count: pendingPurged }, 'expired pending uploads purged');
    } catch (err) {
      ctx.log.error({ err }, 'failed to purge expired pending uploads');
      Sentry.captureException(err, {
        tags: { 'cron.job': 'data-purge', 'purge.target': 'pending_uploads' },
      });
      results.pendingUploads = 0;
    }

    const totalPurged = Object.values(results).reduce((sum, v) => sum + v, 0);

    ctx.log.info(
      { ...results, totalPurged, retentionDays: RETENTION_DAYS },
      'data purge completed',
    );
    metrics.gauge('cron.data_purge.total', totalPurged);
    metrics.gauge('cron.data_purge.documents', results.documents ?? 0);
    metrics.gauge('cron.data_purge.invoices', results.invoices ?? 0);

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: {
        purged: results,
        totalPurged,
        retentionDays: RETENTION_DAYS,
        cutoffDate: cutoff.toISOString(),
      },
    };
  } catch (err) {
    ctx.log.error({ err }, 'data purge failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'data-purge' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
