import type { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Single source of truth for the derived OpenAPI 3.1 document. Reused by the
 * runtime `/openapi.json` endpoint AND the build-time spec-snapshot script
 * (98-11) so the published SDK is generated from exactly what the server serves.
 *
 * Write routes are marked `hide: true` on their `createRoute` definitions, so
 * they are absent from this document by construction — the spec/SDK darkness
 * layer that composes with the per-org `module.public-api` runtime gate.
 */
// biome-ignore lint/suspicious/noExplicitAny: OpenAPIHono is generic over its
// route env/schema; the doc builder is agnostic to those type parameters.
export function buildOpenApiDocument(app: OpenAPIHono<any, any, any>) {
  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Contractor Ops Enterprise API',
      version: '1.0.0',
      description:
        'REST API for Enterprise customers to integrate Contractor Ops with external systems.',
    },
    servers: [{ url: '/v1' }],
  });
}
