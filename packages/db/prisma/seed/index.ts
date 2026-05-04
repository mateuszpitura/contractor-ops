import { getBaseLoggerOptions } from '@contractor-ops/logger';
import pino from 'pino';
import { PrismaClient } from '../../src/generated/prisma/client/client.js';
import { seedTaxRates } from './tax-rates.js';
import { seedWhtRates } from './wht-rates.js';

// F-OBS-12 — share baseOptions with the rest of the app (PII redact + ISO time).
const log = pino({ ...getBaseLoggerOptions(), name: 'prisma-seed' });
const prisma = new PrismaClient();

async function main() {
  await seedTaxRates(prisma);
  await seedWhtRates(prisma);
}

main()
  .catch(e => {
    log.error({ err: e }, 'seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
