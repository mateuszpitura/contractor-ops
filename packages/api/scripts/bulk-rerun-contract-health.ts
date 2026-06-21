// Phase 75 D-04 — Idempotent admin script for model-bump bulk re-run.
// Mirrors Phase 71 D-13 / 71-07 backfill convention. Paces enqueueing at
// QStash native delay (2s per call) to respect Anthropic Tier-2 rate limits.
//
// Usage:
//   pnpm tsx packages/api/scripts/bulk-rerun-contract-health.ts <organizationId> [--force] [--dry-run]
//   pnpm tsx packages/api/scripts/bulk-rerun-contract-health.ts --all-orgs [--force] [--dry-run]

import { PrismaClient } from '@contractor-ops/db';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import pino from 'pino';
import { writeAuditLog } from '../src/services/audit-writer.js';

const log = pino({ ...getBaseLoggerOptions(), name: 'bulk-rerun-contract-health' });
const PAGE_SIZE = 100;

interface Args {
  organizationId?: string;
  allOrgs: boolean;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const force = argv.includes('--force');
  const dryRun = argv.includes('--dry-run');
  const allOrgs = argv.includes('--all-orgs');
  const orgArg = argv.find(a => !a.startsWith('--'));
  return { organizationId: orgArg, allOrgs, force, dryRun };
}

type QStashClient = ReturnType<typeof getQStashClient>;

async function rerunOrg(
  db: PrismaClient,
  qstash: QStashClient | null,
  url: string,
  organizationId: string,
  args: Args,
): Promise<void> {
  let enqueued = 0;
  let cursor: string | undefined;

  for (;;) {
    const contracts = await db.contract.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (contracts.length === 0) break;

    for (const c of contracts) {
      if (args.dryRun) {
        log.info({ organizationId, contractId: c.id }, 'DRY-RUN would enqueue');
      } else {
        await qstash?.publishJSON({
          url,
          body: {
            organizationId,
            contractId: c.id,
            triggeredBy: 'MODEL_BUMP_BULK' as const,
            triggeredByUserId: null,
            force: args.force,
          },
          retries: 3,
          delay: 2, // 2s pace — Anthropic Tier-2 headroom
        });
        enqueued++;
      }
    }
    cursor = contracts[contracts.length - 1]?.id;
  }

  if (!args.dryRun && enqueued > 0) {
    await writeAuditLog({
      organizationId,
      actorType: 'SYSTEM',
      actorId: 'bulk-rerun-script',
      action: 'compliance.ip_clause.bulk_rerun_started',
      resourceType: 'ORGANIZATION',
      resourceId: organizationId,
      newValues: { enqueuedCount: enqueued, force: args.force },
    });
  }

  log.info({ organizationId, enqueued, dryRun: args.dryRun }, 'org complete');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!(args.organizationId || args.allOrgs)) {
    log.error('Provide either an organizationId or --all-orgs');
    process.exit(1);
  }

  const db = new PrismaClient();
  const qstash = args.dryRun ? null : getQStashClient();
  const url = `${getServerEnv().API_URL}/contract-health/_run`;

  const orgIds = args.allOrgs
    ? (await db.organization.findMany({ select: { id: true } })).map(o => o.id)
    : [args.organizationId as string];

  for (const organizationId of orgIds) {
    await rerunOrg(db, qstash, url, organizationId, args);
  }

  await db.$disconnect();
}

main().catch(err => {
  log.error({ err }, 'bulk-rerun failed');
  process.exit(1);
});
