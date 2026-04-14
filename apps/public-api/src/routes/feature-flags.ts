import { Hono } from 'hono';
import { createPublicCaller } from '../lib/create-caller.js';

const featureFlags = new Hono();

/**
 * GET /feature-flags
 *
 * Returns the resolved feature flag state for the organization owning the API
 * key making this call. Consumers can use this to understand which endpoints
 * will currently return 404 because of a disabled feature flag.
 */
featureFlags.get('/', async c => {
  const caller = createPublicCaller(c);
  const flags = await caller.featureFlags.list();
  return c.json({ data: flags });
});

export default featureFlags;
