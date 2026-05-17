// Idempotent backfill of the `legal-documents` collection from the catalog
// captured in apps/cms/src/lib/legal-content.ts. The catalog is the canonical
// summary of the previously hand-authored TSX content under apps/web/.../(legal)/.
//
// Re-running the script upserts by (type, jurisdiction) — no duplicates.
// After the first successful seed, edits flow through the Payload admin UI;
// this script is only used for first-time setup or recovery.

import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { getPayload } from 'payload';
import pino from 'pino';
import { LEGAL_CATALOG } from '../src/lib/legal-content.js';
import config from '../src/payload.config.js';

const log = pino(getBaseLoggerOptions()).child({ service: 'cms', script: 'migrate-legal' });

// Suppress the afterChange revalidate webhook during the seed — apps/web is
// typically offline when the operator runs the script the first time and
// nothing depends on a tag flip until the first end-user edit anyway.
process.env.CMS_SUPPRESS_WEBHOOKS = '1';

type Outcome = { created: number; updated: number; skipped: number };

async function run(): Promise<Outcome> {
  const payload = await getPayload({ config });
  const outcome: Outcome = { created: 0, updated: 0, skipped: 0 };

  for (const entry of LEGAL_CATALOG) {
    const existing = await payload.find({
      collection: 'legal-documents',
      where: {
        and: [{ type: { equals: entry.type } }, { jurisdiction: { equals: entry.jurisdiction } }],
      },
      locale: entry.locale,
      limit: 1,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      const current = existing.docs[0] as { id: string | number };
      await payload.update({
        collection: 'legal-documents',
        id: current.id,
        locale: entry.locale,
        data: {
          title: entry.title,
          body: entry.body as never,
          version: entry.version,
          effectiveDate: entry.effectiveDate,
        },
      });
      outcome.updated++;
      log.info(
        { type: entry.type, jurisdiction: entry.jurisdiction, locale: entry.locale },
        'updated legal document',
      );
    } else {
      await payload.create({
        collection: 'legal-documents',
        locale: entry.locale,
        data: {
          type: entry.type,
          jurisdiction: entry.jurisdiction,
          title: entry.title,
          version: entry.version,
          effectiveDate: entry.effectiveDate,
          body: entry.body as never,
        },
      });
      outcome.created++;
      log.info(
        { type: entry.type, jurisdiction: entry.jurisdiction, locale: entry.locale },
        'created legal document',
      );
    }
  }

  return outcome;
}

run()
  .then(outcome => {
    log.info(outcome, 'migrate-legal complete');
    process.exit(0);
  })
  .catch(err => {
    log.error({ err }, 'migrate-legal failed');
    process.exit(1);
  });
