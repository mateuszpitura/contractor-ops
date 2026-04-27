import pino from 'pino';
import { PrismaClient } from '../../src/generated/prisma/client/client.js';
import { seedTaxRates } from './tax-rates.js';
import { seedWhtRates } from './wht-rates.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
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
