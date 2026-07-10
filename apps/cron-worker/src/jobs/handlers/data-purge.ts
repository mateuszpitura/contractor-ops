/**
 * Data retention purge handler.
 *
 * Daily 03:00 UTC sweep: permanently deletes soft-deleted records older
 * than RETENTION_DAYS plus the associated R2 files for purged documents.
 *
 * Runs once PER configured region: the single frankfurt cron-worker iterates
 * `SUPPORTED_REGIONS`, resolving each region's base writer via
 * `getRegionalClient` and finalising that region's soft-deletes / GDPR
 * erasures. A region whose `DATABASE_URL_<region>` is unset (e.g. US locally)
 * throws in `getRegionalClient` and is skipped. R2 cleanup targets the org's
 * regional bucket via `deleteRegionalObject(key, region)` (the cron has no
 * tenant context, so the region is passed explicitly).
 *
 * Delete order matters — children before parents to respect FK constraints:
 *   1. R2 files for documents (BEFORE DB rows — retry-safe if R2 fails)
 *   2. DocumentLinks
 *   3. InvoiceFiles
 *   4. Documents
 *   5. Invoices
 *   6. Contracts
 *   7. Contractors
 *   8. PersonnelFileDocuments (children) then PersonnelFiles (parents)
 *
 * Personnel-file rows carry per-jurisdiction statutory windows (akta osobowe /
 * Personalakte / UK file / US I-9) that are anchored on hire/termination/document
 * events rather than on `deletedAt`, so they are resolved per row via
 * `getPersonnelRetentionCutoff` and excluded from the flat 90-day sweep while
 * still inside their window — a Document held by an active akta section also
 * survives the flat Document sweep.
 *
 * Plus two ephemeral table sweeps (OAuthChallenge, PendingUpload) that
 * self-expire via `expiresAt`. Each ephemeral sweep is independent — one
 * failing does not abort the other.
 *
 * Explicit tx timeout/maxWait so a wedged purge never starves other
 * tenants' cron mutations on the Neon HTTP driver.
 */

import type {
  Jurisdiction,
  PersonnelFileSection,
  PersonnelRetentionRule,
} from '@contractor-ops/compliance-policy';
import {
  getPersonnelRetentionRules,
  getPersonnelSections,
  mapCountryCodeToJurisdiction,
} from '@contractor-ops/compliance-policy';
import type { DataRegion } from '@contractor-ops/db';
import {
  getPersonnelRetentionCutoff,
  getRegionalClient,
  getRetentionCutoff,
  SUPPORTED_REGIONS,
} from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

/** The regional writer client each purge pass runs against. */
type RegionalClient = ReturnType<typeof getRegionalClient>;

const RETENTION_DAYS = 90;

/** Shape needed to resolve a single personnel document's retention disposition. */
type PersonnelDocRetentionRow = {
  section: PersonnelFileSection | null;
  documentDate: Date | null;
  personnelFile: { countryCode: string; hireDate: Date | null; terminatedAt: Date | null };
  document: { createdAt: Date };
};

/**
 * A personnel document is erasable only when its section's statutory window has
 * elapsed. An unknown jurisdiction or an unclassified document has no resolvable
 * window, so it is held (fail-closed) rather than risk purging a retained file.
 */
function isPersonnelDocErasable(row: PersonnelDocRetentionRow, now: Date): boolean {
  const jurisdiction = mapCountryCodeToJurisdiction(row.personnelFile.countryCode);
  if (!jurisdiction || row.section === null) return false;
  const rules = getPersonnelRetentionRules(jurisdiction, row.section, row.personnelFile.hireDate);
  return getPersonnelRetentionCutoff(rules, {
    hireDate: row.personnelFile.hireDate,
    terminationDate: row.personnelFile.terminatedAt,
    documentDate: row.documentDate ?? row.document.createdAt,
    now,
  }).erasable;
}

/**
 * File-level retention rules for a jurisdiction: the union of every section's
 * rules anchored on the employment lifecycle (hire/termination), deduped by
 * recordType. DOCUMENT_DATE rules (e.g. DE accident records) are per-document and
 * enforced on the PersonnelFileDocument, so excluding them here prevents a file
 * with no document date from being held forever.
 */
function personnelFileLevelRules(jurisdiction: Jurisdiction): PersonnelRetentionRule[] {
  const seen = new Set<string>();
  const rules: PersonnelRetentionRule[] = [];
  for (const section of getPersonnelSections(jurisdiction)) {
    for (const rule of section.retentionRules) {
      if (rule.anchor === 'DOCUMENT_DATE' || seen.has(rule.recordType)) continue;
      seen.add(rule.recordType);
      rules.push(rule);
    }
  }
  return rules;
}

/** Whether a soft-deleted PersonnelFile is past its own file-level window. */
function isPersonnelFileErasable(
  file: { countryCode: string; hireDate: Date | null; terminatedAt: Date | null },
  now: Date,
): boolean {
  const jurisdiction = mapCountryCodeToJurisdiction(file.countryCode);
  if (!jurisdiction) return false;
  return getPersonnelRetentionCutoff(personnelFileLevelRules(jurisdiction), {
    hireDate: file.hireDate,
    terminationDate: file.terminatedAt,
    documentDate: null,
    now,
  }).erasable;
}

/**
 * THE load-bearing hard-delete path. `data-purge` runs on the BASE prisma
 * client (no soft-delete extension), so every `deleteMany` here is a TRUE
 * Postgres DELETE. A model under an active statutory-retention rule must
 * therefore use its policy window (4yr/7yr) instead of the flat 90-day sweep,
 * or a retained record could be permanently destroyed.
 *
 * Returns the per-model cutoff: the retention window for a retained model, else
 * the flat `RETENTION_DAYS` cutoff. The production retention map ships EMPTY,
 * so all current models keep the 90-day behaviour; new tax models inherit the
 * guard automatically by registering their window.
 */
function cutoffFor(model: string, now: Date, flatCutoff: Date): Date {
  return getRetentionCutoff(model, now) ?? flatCutoff;
}

async function purgeR2Files(
  docs: Array<{ id: string; storageKey: string | null }>,
  region: DataRegion,
  log: Parameters<JobHandler>[0]['log'],
): Promise<{ failedR2DocIds: Set<string>; r2Deleted: number; skippedNoKey: number }> {
  const failedR2DocIds = new Set<string>();
  let r2Deleted = 0;
  let skippedNoKey = 0;

  if (docs.length === 0) return { failedR2DocIds, r2Deleted, skippedNoKey };

  // Delete against the org's regional bucket, not the legacy single default
  // bucket — the cron carries no tenant context, so the region is passed
  // explicitly rather than resolved from `tenantStore`.
  const { deleteRegionalObject } = await import('@contractor-ops/api/services/regional-storage');

  for (const doc of docs) {
    if (!doc.storageKey) {
      skippedNoKey++;
      continue;
    }
    try {
      await deleteRegionalObject(doc.storageKey, region);
      r2Deleted++;
    } catch (err) {
      log.warn(
        { storageKey: doc.storageKey, documentId: doc.id, region, err },
        'failed to delete R2 object — excluding from DB purge',
      );
      failedR2DocIds.add(doc.id);
    }
  }

  return { failedR2DocIds, r2Deleted, skippedNoKey };
}

/**
 * Runs the full retention purge against ONE regional database + its R2 bucket.
 *
 * The cron carries no tenant context, so `client` (the region's base writer from
 * `getRegionalClient`) and `region` are threaded explicitly — every `deleteMany`
 * is a true Postgres DELETE and every R2 delete targets the org's regional
 * bucket via `deleteRegionalObject(key, region)`.
 */
async function purgeRegion(
  client: RegionalClient,
  region: DataRegion,
  ctx: Parameters<JobHandler>[0],
  now: Date,
  cutoff: Date,
): Promise<{ counts: Record<string, number>; sweepFailures: number; heldDocuments: number }> {
  const results: Record<string, number> = {};
  let sweepFailures = 0;

  // 1. Snapshot the documents to purge so R2 cleanup + DB deletion
  //    operate on the exact same set (no race between query + delete).
  const docCutoff = cutoffFor('Document', now, cutoff);
  const expiredDocs = await client.document.findMany({
    where: { deletedAt: { not: null, lt: docCutoff } },
    select: { id: true, storageKey: true },
  });
  const docIds = expiredDocs.map(d => d.id);

  // 1b. A Document linked into an akta section that is still inside its
  //     statutory window must survive the flat sweep (its bytes are held).
  //     Resolve each candidate's personnel retention and hold the not-yet-
  //     erasable ones — both from R2 cleanup and the DB delete.
  const personnelLinksForDocs =
    docIds.length > 0
      ? await client.personnelFileDocument.findMany({
          where: { documentId: { in: docIds } },
          select: {
            documentId: true,
            section: true,
            documentDate: true,
            personnelFile: { select: { countryCode: true, hireDate: true, terminatedAt: true } },
            document: { select: { createdAt: true } },
          },
        })
      : [];
  const heldDocumentIds = new Set<string>();
  for (const link of personnelLinksForDocs) {
    if (!isPersonnelDocErasable(link, now)) heldDocumentIds.add(link.documentId);
  }
  const purgeableDocs = expiredDocs.filter(d => !heldDocumentIds.has(d.id));
  if (heldDocumentIds.size > 0) {
    ctx.log.info(
      { count: heldDocumentIds.size, region },
      'documents held by an active personnel-file retention window — excluded from purge',
    );
  }

  // 2. R2 cleanup before DB — DB rows still reference the keys for retry.
  const { failedR2DocIds, r2Deleted, skippedNoKey } = await purgeR2Files(
    purgeableDocs,
    region,
    ctx.log,
  );
  if (skippedNoKey > 0) {
    ctx.log.info(
      { count: skippedNoKey, region },
      'documents with null storageKey skipped during R2 cleanup',
    );
  }
  results.r2Files = r2Deleted;
  results.purgeSkippedR2KeyMissing = skippedNoKey;

  const safeDocIds = purgeableDocs.map(d => d.id).filter(id => !failedR2DocIds.has(id));

  // 2b. Personnel-file sweep candidates (soft-deleted rows past the flat floor).
  //     Resolve erasability per row so held/indefinite rows are never purged.
  const expiredPersonnelDocs = await client.personnelFileDocument.findMany({
    where: { deletedAt: { not: null, lt: cutoffFor('PersonnelFileDocument', now, cutoff) } },
    select: {
      id: true,
      section: true,
      documentDate: true,
      personnelFile: { select: { countryCode: true, hireDate: true, terminatedAt: true } },
      document: { select: { createdAt: true } },
    },
  });
  const erasablePersonnelDocIds = expiredPersonnelDocs
    .filter(pd => isPersonnelDocErasable(pd, now))
    .map(pd => pd.id);

  const expiredPersonnelFiles = await client.personnelFile.findMany({
    where: { deletedAt: { not: null, lt: cutoffFor('PersonnelFile', now, cutoff) } },
    select: { id: true, countryCode: true, hireDate: true, terminatedAt: true },
  });
  const erasablePersonnelFileIds = expiredPersonnelFiles
    .filter(pf => isPersonnelFileErasable(pf, now))
    .map(pf => pf.id);

  // 3. DB deletion in a single tx (children → parents).
  const txResults = await client.$transaction(
    async tx => {
      const txRes: Record<string, number> = {
        documentLinks: 0,
        invoiceFiles: 0,
        documents: 0,
        personnelFileDocuments: 0,
        personnelFiles: 0,
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
        where: { deletedAt: { not: null, lt: cutoffFor('Invoice', now, cutoff) } },
      });
      txRes.invoices = invResult.count;

      const contractResult = await tx.contract.deleteMany({
        where: { deletedAt: { not: null, lt: cutoffFor('Contract', now, cutoff) } },
      });
      txRes.contracts = contractResult.count;

      const contractorResult = await tx.contractor.deleteMany({
        where: { deletedAt: { not: null, lt: cutoffFor('Contractor', now, cutoff) } },
      });
      txRes.contractors = contractorResult.count;

      // Personnel-file rows: children (documents) before parents. Only the
      // ids resolved as erasable above are deleted, so a row still inside its
      // statutory window (or indefinite while active) is never purged.
      if (erasablePersonnelDocIds.length > 0) {
        const pfDocResult = await tx.personnelFileDocument.deleteMany({
          where: { id: { in: erasablePersonnelDocIds } },
        });
        txRes.personnelFileDocuments = pfDocResult.count;
      }

      if (erasablePersonnelFileIds.length > 0) {
        // A file is purgeable only once every one of its documents is gone —
        // a surviving (held) document keeps the whole file.
        const filesWithDocs = await tx.personnelFileDocument.findMany({
          where: { personnelFileId: { in: erasablePersonnelFileIds } },
          select: { personnelFileId: true },
          distinct: ['personnelFileId'],
        });
        const stillHasDocs = new Set(filesWithDocs.map(f => f.personnelFileId));
        const purgeableFileIds = erasablePersonnelFileIds.filter(id => !stillHasDocs.has(id));
        if (purgeableFileIds.length > 0) {
          const pfResult = await tx.personnelFile.deleteMany({
            where: { id: { in: purgeableFileIds } },
          });
          txRes.personnelFiles = pfResult.count;
        }
      }

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
    const oauthPurged = await purgeExpiredOAuthChallenges(client);
    results.oauthChallenges = oauthPurged;
    ctx.log.info({ count: oauthPurged, region }, 'expired oauth challenges purged');
  } catch (err) {
    ctx.log.error({ err, region }, 'failed to purge expired oauth challenges');
    Sentry.captureException(err, {
      tags: {
        'cron.job': 'data-purge',
        'purge.target': 'oauth_challenges',
        'purge.region': region,
      },
    });
    results.oauthChallenges = 0;
    sweepFailures++;
  }

  try {
    const { purgeExpiredPendingUploads } = await import(
      '@contractor-ops/api/services/pending-upload'
    );
    const pendingPurged = await purgeExpiredPendingUploads(client);
    results.pendingUploads = pendingPurged;
    ctx.log.info({ count: pendingPurged, region }, 'expired pending uploads purged');
  } catch (err) {
    ctx.log.error({ err, region }, 'failed to purge expired pending uploads');
    Sentry.captureException(err, {
      tags: { 'cron.job': 'data-purge', 'purge.target': 'pending_uploads', 'purge.region': region },
    });
    results.pendingUploads = 0;
    sweepFailures++;
  }

  return { counts: results, sweepFailures, heldDocuments: heldDocumentIds.size };
}

export const dataPurgeHandler: JobHandler = async ctx => {
  const start = performance.now();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const results: Record<string, number> = {};
  let sweepFailures = 0;
  let heldDocuments = 0;
  const regionsPurged: DataRegion[] = [];
  const regionsSkipped: DataRegion[] = [];
  let firstError: string | null = null;

  try {
    // Every configured region runs its own purge — a single frankfurt cron-worker
    // must finalise ME (and future US) soft-deletes + GDPR erasures, not just the
    // DATABASE_URL region. A region whose DATABASE_URL_<region> is unset (e.g. US
    // locally) throws in getRegionalClient and is skipped.
    for (const region of SUPPORTED_REGIONS) {
      let client: RegionalClient;
      try {
        client = getRegionalClient(region);
      } catch {
        regionsSkipped.push(region);
        ctx.log.info({ region }, 'region has no configured database — purge skipped');
        continue;
      }

      try {
        const regionResult = await purgeRegion(client, region, ctx, now, cutoff);
        for (const [key, value] of Object.entries(regionResult.counts)) {
          results[key] = (results[key] ?? 0) + value;
        }
        sweepFailures += regionResult.sweepFailures;
        heldDocuments += regionResult.heldDocuments;
        regionsPurged.push(region);
      } catch (err) {
        ctx.log.error({ err, region }, 'data purge failed for region');
        Sentry.captureException(err, {
          tags: { 'cron.job': 'data-purge', 'purge.region': region },
        });
        sweepFailures++;
        if (!firstError) firstError = err instanceof Error ? err.message : String(err);
      }
    }

    const totalPurged = Object.values(results).reduce((sum, v) => sum + v, 0);

    ctx.log.info(
      {
        ...results,
        totalPurged,
        sweepFailures,
        retentionDays: RETENTION_DAYS,
        regionsPurged,
        regionsSkipped,
      },
      'data purge completed',
    );
    metrics.gauge('cron.data_purge.total', totalPurged);
    metrics.gauge('cron.data_purge.documents', results.documents ?? 0);
    metrics.gauge('cron.data_purge.invoices', results.invoices ?? 0);
    metrics.gauge('cron.data_purge.personnel_file_documents', results.personnelFileDocuments ?? 0);
    metrics.gauge('cron.data_purge.personnel_files', results.personnelFiles ?? 0);
    metrics.gauge('cron.data_purge.personnel_held_documents', heldDocuments);
    metrics.gauge('cron.data_purge.oauth_challenges', results.oauthChallenges ?? 0);
    metrics.gauge('cron.data_purge.pending_uploads', results.pendingUploads ?? 0);
    metrics.gauge('cron.data_purge.regions', regionsPurged.length);
    metrics.gauge('cron.data_purge.sweep_failures', sweepFailures);

    return {
      ok: sweepFailures === 0,
      durationMs: Math.round(performance.now() - start),
      details: {
        purged: results,
        totalPurged,
        sweepFailures,
        retentionDays: RETENTION_DAYS,
        cutoffDate: cutoff.toISOString(),
        regionsPurged,
        regionsSkipped,
        ...(firstError ? { error: firstError } : {}),
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
