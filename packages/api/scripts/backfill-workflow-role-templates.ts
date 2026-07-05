#!/usr/bin/env tsx
/**
 * One-shot backfill: materialise the offboarding KT `WorkflowRoleTemplate`
 * seed rows for organizations that pre-date the `afterCreateOrganization` seed
 * hook (packages/auth/src/config.ts → `seedOrganizationDefaults`). New orgs are
 * seeded at creation time by that hook; existing orgs need this pass.
 *
 * Idempotent: delegates to `runPostOrganizationCreateHooks`, which calls the
 * `upsertSeedTemplates` upsert (keyed on the canonical `@@unique` constraints),
 * so re-running is safe and orgs already carrying seeds are no-ops.
 *
 * Cross-org batch: uses the un-scoped `prismaRaw` client (no tenant frame is
 * active in a standalone script — the tenant-scoped client would reject these
 * writes) to enumerate every org and seed each one.
 *
 * Per-region: run once per regional database URL.
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/api/scripts/backfill-workflow-role-templates.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/api/scripts/backfill-workflow-role-templates.ts
 *
 *   # Dry-run (enumerate orgs, no writes):
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/api/scripts/backfill-workflow-role-templates.ts --dry-run
 */

import { prismaRaw } from '@contractor-ops/db';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import pino from 'pino';
import { runPostOrganizationCreateHooks } from '../src/services/post-org-create-hook.js';

const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-workflow-role-templates' });
const PAGE_SIZE = 200;

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  let processed = 0;
  let cursor: string | undefined;

  for (;;) {
    const orgs = await prismaRaw.organization.findMany({
      select: { id: true },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (orgs.length === 0) break;

    for (const org of orgs) {
      if (dryRun) {
        log.info({ organizationId: org.id }, 'DRY-RUN would seed workflow role templates');
      } else {
        // Idempotent + non-fatal per org: the hook logs and swallows a failed
        // upsert so one bad org does not abort the whole backfill.
        await runPostOrganizationCreateHooks(prismaRaw, org.id);
      }
      processed++;
    }

    cursor = orgs[orgs.length - 1]?.id;
  }

  log.info({ processed, dryRun }, 'workflow-role-template backfill complete');
  await prismaRaw.$disconnect();
}

main().catch(err => {
  log.error({ err }, 'workflow-role-template backfill failed');
  process.exit(1);
});
