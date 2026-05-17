import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { getPayload } from 'payload';
import pino from 'pino';
import { requireCmsEnv } from '../src/lib/env.js';
import config from '../src/payload.config.js';

const log = pino(getBaseLoggerOptions()).child({ service: 'cms', script: 'seed-admin' });

async function main(): Promise<void> {
  const email = requireCmsEnv('CMS_ADMIN_EMAIL');
  const password = requireCmsEnv('CMS_ADMIN_PASSWORD');

  const payload = await getPayload({ config });
  const existing = await payload.find({ collection: 'users', limit: 1 });
  if (existing.totalDocs > 0) {
    payload.logger.info({ count: existing.totalDocs }, 'admin user already exists, skipping seed');
    return;
  }

  const user = await payload.create({
    collection: 'users',
    data: { email, password, name: 'Admin' },
  });
  payload.logger.info({ id: user.id, email }, 'seeded initial admin user');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    log.error({ err }, 'seed-admin failed');
    process.exit(1);
  });
