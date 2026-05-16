import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../../src/generated/prisma/client/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(here, '../seed-data/boe-base-rate-history.json');

interface BoeRateRow {
  effectiveFrom: string;
  ratePercent: string;
}

/**
 * Seed the global Bank of England base-rate history table.
 *
 * Reads `prisma/seed-data/boe-base-rate-history.json` (the canonical static
 * dataset; updates land via PR when the BoE MPC publishes a new decision)
 * and upserts each row by its `effectiveFrom` natural key so reruns on
 * already-seeded environments are no-ops.
 *
 * Required by Phase 63 UK late-payment interest calculations
 * (statutory rate = BoE base + 8%) — the calc reads the history table to
 * pick the rate effective on the invoice's overdue date.
 *
 * source = MANUAL because these rows are curated by hand from BoE
 * publications, not pulled live from the BoE rate API.
 */
export async function seedBoeRates(prisma: PrismaClient): Promise<void> {
  const raw = await readFile(DATA_PATH, 'utf8');
  const rows = JSON.parse(raw) as BoeRateRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`boe-base-rate-history.json is empty or malformed: ${DATA_PATH}`);
  }
  for (const row of rows) {
    const effectiveFrom = new Date(row.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new Error(`invalid effectiveFrom in BoE seed: ${row.effectiveFrom}`);
    }
    await prisma.boEBaseRateHistory.upsert({
      where: { effectiveFrom },
      update: { ratePercent: row.ratePercent, source: 'MANUAL' },
      create: {
        effectiveFrom,
        ratePercent: row.ratePercent,
        source: 'MANUAL',
      },
    });
  }
}
