import { createApiKeyContext, createCallerFactory, publicApiRouter } from '@contractor-ops/api';
import type { Context } from 'hono';

const factory = createCallerFactory(publicApiRouter);

/**
 * Builds a tRPC caller for the public API router from a Hono request context.
 * Passes through the Authorization header so the apiKeyTenantProcedure
 * middleware can validate the API key.
 */
export function createPublicCaller(c: Context) {
  const headers = new Headers();
  headers.set('authorization', c.req.header('authorization') ?? '');

  const ctx = createApiKeyContext({ headers });
  return factory(ctx);
}
