import { preWarmRegionalClients } from '@contractor-ops/db';
import { serve } from '@hono/node-server';
import app from './app.js';

const PORT = Number(process.env.PUBLIC_API_PORT ?? 4100);

// Pre-warm regional Prisma clients before accepting requests
await preWarmRegionalClients();

serve({
  fetch: app.fetch,
  port: PORT,
});
