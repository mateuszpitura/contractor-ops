#!/usr/bin/env tsx
/**
 * Backfill PersonnelFile rows (with hireDate) for existing EMPLOYEE workers that
 * were registered before register started creating personnel files.
 *
 * Without a PersonnelFile/hireDate the leave-accrual cron skips the worker.
 * hireDate is taken from EmployeeProfile.createdAt (UTC date) when present.
 *
 * Idempotent: only workers with workerType=EMPLOYEE and no PersonnelFile row.
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-personnel-file.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-personnel-file.ts
 *
 *   # Dry-run:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-personnel-file.ts --dry-run
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-personnel-file' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });

const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.error('DATABASE_URL is required');
    process.exit(1);
  }

  const { PrismaClient } = await import('@contractor-ops/db/generated/prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    const employees = await prisma.employeeProfile.findMany({
      where: {
        worker: {
          workerType: 'EMPLOYEE',
          deletedAt: null,
          personnelFile: null,
        },
      },
      select: {
        workerId: true,
        organizationId: true,
        countryCode: true,
        createdAt: true,
        worker: { select: { createdAt: true } },
      },
    });

    log.info({ count: employees.length, dryRun }, 'employees missing PersonnelFile');

    let created = 0;
    for (const emp of employees) {
      const hireSource = emp.createdAt ?? emp.worker.createdAt;
      const hireDate = new Date(
        Date.UTC(hireSource.getUTCFullYear(), hireSource.getUTCMonth(), hireSource.getUTCDate()),
      );

      if (dryRun) {
        log.info(
          {
            workerId: emp.workerId,
            organizationId: emp.organizationId,
            countryCode: emp.countryCode,
            hireDate: hireDate.toISOString(),
          },
          'would create PersonnelFile',
        );
        created += 1;
        continue;
      }

      await prisma.personnelFile.create({
        data: {
          organizationId: emp.organizationId,
          workerId: emp.workerId,
          countryCode: emp.countryCode,
          hireDate,
        },
      });
      created += 1;
    }

    log.info({ created, dryRun }, 'backfill-personnel-file complete');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  log.error({ err }, 'backfill-personnel-file failed');
  process.exit(1);
});
