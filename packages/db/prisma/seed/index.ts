import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config as loadEnv } from 'dotenv';
import pino from 'pino';
import { createPrismaClientForUrl } from '../../src/client.js';
import { seedBoeRates } from './boe-rates.js';
import { seedTax1099Config } from './tax-1099-config.js';
import { seedTaxRates } from './tax-rates.js';
import { seedWhtRates } from './wht-rates.js';

// Load repo-root .env so `pnpm prisma db seed` picks up DATABASE_URL without
// the operator having to source it manually.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../../.env') });

// F-OBS-12 — share baseOptions with the rest of the app (PII redact + ISO time).
const log = pino({ ...getBaseLoggerOptions(), name: 'prisma-seed' });

// Use the shared `createPrismaClientForUrl` factory — it wires the Neon
// PrismaPg adapter, the connection pool tuned for Neon's per-project socket
// budget, and the F-OBS-10 slow-query Pino logger. Plain `new PrismaClient()`
// here would bypass all of that and leave the seed run unobservable.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  log.error('DATABASE_URL is not set — refusing to run seed without a target DB');
  process.exit(1);
}
const prisma = createPrismaClientForUrl(connectionString);

async function main() {
  await seedTaxRates(prisma);
  await seedWhtRates(prisma);
  await seedBoeRates(prisma);
  await seedTax1099Config(prisma);
}

main()
  .catch(e => {
    log.error({ err: e }, 'seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
