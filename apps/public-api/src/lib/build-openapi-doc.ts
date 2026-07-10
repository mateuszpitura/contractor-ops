import type { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Single source of truth for the derived OpenAPI 3.1 document. Reused by the
 * runtime `/openapi.json` endpoint AND the build-time spec-snapshot script
 * (98-11) so the published SDK is generated from exactly what the server serves.
 *
 * Write routes are present in the derived spec (un-hidden post-OWASP gate);
 * each still 404s per-org until `module.public-api` is granted — the runtime
 * gate is the darkness layer, not spec omission.
 */
// biome-ignore lint/suspicious/noExplicitAny: OpenAPIHono is generic over its route env/schema; the doc builder is agnostic to those type params.
export function buildOpenApiDocument(app: OpenAPIHono<any, any, any>) {
  // The app is mounted at `basePath('/v1')`, so the derived paths already carry
  // the `/v1` version segment (e.g. `/v1/contractors`). `servers` must therefore
  // be the bare API origin — NOT `/v1` — or consumers would double-prefix to
  // `/v1/v1/...`.
  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Contractor Ops Enterprise API',
      version: '1.0.0',
      description:
        'REST API for Enterprise customers to integrate Contractor Ops with external systems.',
    },
    servers: [{ url: 'https://api.contractor-ops.com', description: 'Production' }],
  });
}
