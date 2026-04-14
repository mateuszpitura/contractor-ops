import { preWarmRegionalClients } from '@contractor-ops/db';
import { serve } from '@hono/node-server';
import app from './app.js';

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

const required = ['API_KEY_HMAC_SECRET'] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}. See .env.example.`);
  }
}

const PORT = Number(process.env.PUBLIC_API_PORT ?? 4100);

// Pre-warm regional Prisma clients before accepting requests
await preWarmRegionalClients();

serve({
  fetch: app.fetch,
  port: PORT,
});

console.info(`[public-api] Enterprise REST API listening on http://localhost:${PORT}/api/v1`);
