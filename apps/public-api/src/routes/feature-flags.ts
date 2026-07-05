import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createPublicCaller, errorResponses } from '../lib/openapi-route.js';

const featureFlags = new OpenAPIHono();

const featureFlagItem = z
  .object({
    key: z.string(),
    description: z.string(),
    enabled: z.boolean(),
  })
  .openapi('PublicFeatureFlag');

/**
 * GET /feature-flags
 *
 * Returns the resolved feature flag state for the organization owning the API
 * key making this call. Consumers use this to understand which endpoints will
 * currently return 404 because of a disabled feature flag. Not paginated — the
 * flag registry is small and bounded.
 */
const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ data: z.array(featureFlagItem) }) } },
      description: 'Resolved feature-flag state for the calling organization',
    },
    ...errorResponses,
  },
});

featureFlags.openapi(listRoute, async c => {
  const caller = createPublicCaller(c);
  const flags = await caller.featureFlags.list();
  return c.json({ data: flags }, 200);
});

export default featureFlags;
