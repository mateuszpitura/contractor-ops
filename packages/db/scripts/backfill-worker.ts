#!/usr/bin/env tsx
/**
 * One-time, additive, idempotent, per-region, reversible Worker backfill.
 *
 * Creates one `Worker` identity row per existing v1–v6 contractor that has no
 * worker link yet, and atomically sets `Contractor.workerId` in the SAME
 * transaction step. This is the data step that sits between Migration A (which
 * adds the nullable `Contractor.workerId` column + unique index) and Migration B
 * (which promotes the column to NOT NULL + adds the FK). It must run AFTER A and
 * BEFORE B — running B before this leaves existing null rows that fail NOT NULL.
 *
 * Idempotent: only contractors WHERE workerId IS NULL are linked, so a re-run
 * produces zero new inserts. The `Contractor.workerId @unique` index makes a
 * double-link a DB-enforced conflict rather than a silent duplicate.
 *
 * Reversible: `--rollback` nulls the `workerId` of every contractor this backfill
 * linked and deletes the now-orphaned `Worker` rows. A `Contractor` row is NEVER
 * touched destructively or relinked — only the added link is removed, restoring
 * the exact pre-backfill contractor state.
 *
 * Audit: after the apply (not the dry-run), one system-actor AuditLog row is
 * written per organization recording the count of workers created for that org.
 * The row is inserted directly through the Prisma client because this script
 * lives in `@contractor-ops/db`, which sits below `@contractor-ops/api` (the home
 * of `writeAuditLog`) in the dependency graph — importing it here would create a
 * cycle. The row shape mirrors the audit-writer's canonical shape. `EntityType`
 * has no `WORKER` member, so the org-scoped backfill is recorded against the
 * `ORGANIZATION` resource with `resourceId = organizationId`.
 *
 * Batching: creates are chunked (~1k contractors per `$transaction`) so the
 * largest org does not hold a single mega-transaction long enough to lock rows
 * or hit a statement timeout. Each chunk is atomic on its own; a re-run after a
 * partial failure resumes from the unlinked remainder (idempotency guard).
 *
 * Multi-region: invoke once per regional database URL. Run AFTER Migration A and
 * BEFORE Migration B for that region. The apply is gated behind a [BLOCKING]
 * human migration checkpoint — it mutates live regional Postgres.
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-worker.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-worker.ts
 *   DATABASE_URL=$DATABASE_URL_US tsx packages/db/scripts/backfill-worker.ts   # no-op if unset
 *
 *   # Dry-run (no writes):
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-worker.ts --dry-run
 *
 *   # Rollback (null the links + drop orphaned Worker rows; contractors intact):
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-worker.ts --rollback
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-worker' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });

/** How many contractors are created + linked per atomic `$transaction`. */
const BATCH_SIZE = 1000;

/**
 * The contractor projection the backfill needs: identity to copy onto the new
 * `Worker`, plus the current `workerId` so the pure transform can skip rows that
 * are already linked.
 */
export interface ContractorForWorker {
  id: string;
  organizationId: string;
  displayName: string;
  email: string | null;
  workerId: string | null;
}

/** The shared identity fields copied from a contractor onto its new `Worker`. */
export interface WorkerInsert {
  organizationId: string;
  displayName: string;
  email: string | null;
}

/** One planned create-and-link: a `Worker` to insert for a specific contractor. */
export interface WorkerBackfillStep {
  contractorId: string;
  worker: WorkerInsert;
}

/**
 * Pure transform: emit one `Worker` insert per contractor WHERE workerId IS NULL,
 * skipping contractors already carrying a worker link. Re-running over the
 * post-apply state (every planned contractor now linked) yields an empty plan,
 * so the backfill is idempotent. The source array is never mutated.
 */
export function planWorkerBackfill(rows: readonly ContractorForWorker[]): WorkerBackfillStep[] {
  const steps: WorkerBackfillStep[] = [];
  for (const c of rows) {
    if (c.workerId) continue; // already linked — idempotency guard (WHERE workerId IS NULL).
    steps.push({
      contractorId: c.id,
      worker: {
        organizationId: c.organizationId,
        displayName: c.displayName,
        email: c.email,
      },
    });
  }
  return steps;
}

/** Splits an array into fixed-size chunks so each batch commits in its own tx. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const MASKED_URL_PATTERN = /:[^:@/]+@/;

type BackfillPrisma = Awaited<
  ReturnType<typeof import('../src/client.js')['createPrismaClientForUrl']>
>;

/**
 * Applies the backfill: for each unlinked contractor, create a `Worker` and set
 * `Contractor.workerId` to it in the SAME transaction step, then write one
 * system-actor audit row per org. Returns the per-org created counts.
 */
async function applyBackfill(
  prisma: BackfillPrisma,
  steps: readonly WorkerBackfillStep[],
): Promise<Map<string, number>> {
  const perOrgCount = new Map<string, number>();

  for (const batch of chunk(steps, BATCH_SIZE)) {
    // Each contractor's create-Worker + set-workerId pair runs inside one
    // transaction so a contractor is never left half-linked. The whole chunk is
    // atomic: if any pair fails, the entire chunk rolls back and a re-run
    // resumes from the unlinked remainder.
    await prisma.$transaction(async tx => {
      for (const step of batch) {
        const worker = await tx.worker.create({
          data: {
            organizationId: step.worker.organizationId,
            displayName: step.worker.displayName,
            email: step.worker.email,
          },
          select: { id: true },
        });
        await tx.contractor.update({
          where: { id: step.contractorId },
          data: { workerId: worker.id },
        });
      }
    });

    for (const step of batch) {
      perOrgCount.set(
        step.worker.organizationId,
        (perOrgCount.get(step.worker.organizationId) ?? 0) + 1,
      );
    }
  }

  // One system-actor row per org records the one-time backfill. Written directly
  // (not via the api-layer writeAuditLog) to avoid a db→api dependency cycle;
  // the row shape mirrors the audit-writer's canonical shape.
  for (const [organizationId, count] of perOrgCount) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorType: 'SYSTEM',
        actorName: 'worker-backfill',
        action: 'worker.backfill.apply',
        resourceType: 'ORGANIZATION',
        resourceId: organizationId,
        metadataJson: { workersCreated: count },
      },
    });
  }

  return perOrgCount;
}

/**
 * Reverses the backfill: null the `workerId` of every contractor that points at
 * a `Worker`, then delete the now-orphaned `Worker` rows. Contractor rows are
 * never deleted or relinked — only the added link is removed. A system-actor
 * row per org records the reversal.
 */
async function rollbackBackfill(prisma: BackfillPrisma): Promise<Map<string, number>> {
  const linked = await prisma.contractor.findMany({
    where: { workerId: { not: null } },
    select: { id: true, organizationId: true, workerId: true },
  });

  const perOrgCount = new Map<string, number>();
  for (const batch of chunk(linked, BATCH_SIZE)) {
    await prisma.$transaction(async tx => {
      // Null the links first so no FK protects the Worker rows from deletion.
      await tx.contractor.updateMany({
        where: { id: { in: batch.map(c => c.id) } },
        data: { workerId: null },
      });
      const workerIds = batch.map(c => c.workerId).filter((id): id is string => id !== null);
      await tx.worker.deleteMany({ where: { id: { in: workerIds } } });
    });

    for (const c of batch) {
      perOrgCount.set(c.organizationId, (perOrgCount.get(c.organizationId) ?? 0) + 1);
    }
  }

  for (const [organizationId, count] of perOrgCount) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorType: 'SYSTEM',
        actorName: 'worker-backfill',
        action: 'worker.backfill.rollback',
        resourceType: 'ORGANIZATION',
        resourceId: organizationId,
        metadataJson: { workersDropped: count },
      },
    });
  }

  return perOrgCount;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const rollback = process.argv.includes('--rollback');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log.error('DATABASE_URL is not set — refusing to run');
    process.exit(2);
  }

  log.info({ dbUrl: dbUrl.replace(MASKED_URL_PATTERN, ':***@'), dryRun, rollback }, 'connecting');

  // Lazy-import so the pure `planWorkerBackfill` export stays testable without
  // dragging the Prisma runtime into vitest's module graph. Uses the canonical
  // `createPrismaClientForUrl` (modern prisma-client generator) — never the
  // legacy `@prisma/client` default entry, which this repo does not generate.
  const { createPrismaClientForUrl } = await import('../src/client.js');
  const prisma = createPrismaClientForUrl(dbUrl);
  try {
    if (rollback) {
      if (dryRun) {
        const linkedCount = await prisma.contractor.count({
          where: { workerId: { not: null } },
        });
        log.info({ count: linkedCount }, 'dry-run rollback — no writes; linked contractors');
        return;
      }
      const reversed = await rollbackBackfill(prisma);
      const total = [...reversed.values()].reduce((a, b) => a + b, 0);
      log.info({ count: total, orgs: reversed.size }, 'rollback complete; contractor rows intact');
      return;
    }

    const candidates = await prisma.contractor.findMany({
      where: { workerId: null },
      select: { id: true, organizationId: true, displayName: true, email: true },
    });
    log.info({ count: candidates.length }, 'contractors without a worker link');

    const steps = planWorkerBackfill(
      candidates.map(c => ({
        id: c.id,
        organizationId: c.organizationId,
        displayName: c.displayName,
        email: c.email,
        workerId: null,
      })),
    );
    log.info({ count: steps.length }, 'worker rows planned');

    if (dryRun) {
      log.info('dry-run — no writes; no Worker rows created, no links set');
      return;
    }

    const perOrgCount = await applyBackfill(prisma, steps);
    const total = [...perOrgCount.values()].reduce((a, b) => a + b, 0);
    log.info(
      { count: total, orgs: perOrgCount.size },
      'backfill applied; one worker per contractor',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    log.error({ err }, 'backfill failed');
    process.exit(1);
  });
}
