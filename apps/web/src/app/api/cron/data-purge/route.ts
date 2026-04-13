import { timingSafeEqual } from 'node:crypto';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('data-purge');

/**
 * Retention period for soft-deleted records before permanent purge.
 * Privacy policy states: "subscription + 30 days".
 * Soft-deleted records are purged after 90 days for safety margin.
 */
const RETENTION_DAYS = 90;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function purgeR2Files(
  docs: Array<{ id: string; storageKey: string | null }>,
): Promise<{ failedR2DocIds: Set<string>; r2Deleted: number; skippedNoKey: number }> {
  const failedR2DocIds = new Set<string>();
  let r2Deleted = 0;
  let skippedNoKey = 0;

  if (docs.length === 0) {
    return { failedR2DocIds, r2Deleted, skippedNoKey };
  }

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

// ---------------------------------------------------------------------------
// GET /api/cron/data-purge
// ---------------------------------------------------------------------------

/**
 * Data retention auto-purge — runs daily at 03:00 UTC.
 *
 * Permanently deletes soft-deleted records older than RETENTION_DAYS.
 * Also removes associated R2 files for purged documents.
 *
 * Order matters — delete child records before parents to respect FK constraints:
 * 1. DocumentLinks (references documents)
 * 2. InvoiceFiles (references invoices + documents)
 * 3. Documents (has R2 files to clean up)
 * 4. Invoices
 * 5. Contracts
 * 6. Contractors
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const isAuthorized =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor(
    'data-purge',
    () =>
      withCronMonitor('data-purge', async () => {
        try {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

          const results: Record<string, number> = {};

          // 1. Snapshot documents to purge (IDs + storage keys) in a single query.
          //    We hold onto these IDs so that R2 cleanup and DB deletion operate
          //    on the exact same set — no race between query and delete.
          const expiredDocs = await prisma.document.findMany({
            where: {
              deletedAt: { not: null, lt: cutoff },
            },
            select: { id: true, storageKey: true },
          });

          const docIds = expiredDocs.map(d => d.id);

          // 2. Delete R2 files BEFORE DB records — if R2 fails we can retry
          //    because the DB records still reference the storage keys.
          const { failedR2DocIds, r2Deleted, skippedNoKey } = await purgeR2Files(expiredDocs);

          if (skippedNoKey > 0) {
            log.info(
              { count: skippedNoKey },
              'documents with null storageKey skipped during R2 cleanup',
            );
          }
          results.r2Files = r2Deleted;
          results.purgeSkippedR2KeyMissing = skippedNoKey;

          // Exclude documents whose R2 files failed to delete so we can retry next run
          const safeDocIds = docIds.filter(id => !failedR2DocIds.has(id));

          // 3. Delete DB records in a transaction using the snapshotted IDs.
          //    Order: children first (document links, invoice files), then
          //    documents, invoices, contracts, contractors.
          const txResults = await prisma.$transaction(async tx => {
            const txRes: Record<string, number> = {};

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
          });

          Object.assign(results, txResults);

          const totalPurged = Object.values(results).reduce((sum, v) => sum + v, 0);

          log.info(
            { ...results, totalPurged, retentionDays: RETENTION_DAYS },
            'data purge completed',
          );

          metrics.gauge('cron.data_purge.total', totalPurged);
          metrics.gauge('cron.data_purge.documents', results.documents ?? 0);
          metrics.gauge('cron.data_purge.invoices', results.invoices ?? 0);

          return NextResponse.json({
            purged: results,
            totalPurged,
            retentionDays: RETENTION_DAYS,
            cutoffDate: cutoff.toISOString(),
          });
        } catch (error) {
          log.error({ err: error }, 'data purge failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'data-purge' },
          });
          return NextResponse.json({ error: 'Data purge failed' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 3 * * *' },
      timezone: 'UTC',
    },
  );
}
