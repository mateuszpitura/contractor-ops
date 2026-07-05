import { evaluate } from '@contractor-ops/feature-flags';
import { generateInsomnia, generatePostman } from '@contractor-ops/marketplace-manifests';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { buildOpenApiDocument } from '../lib/build-openapi-doc.js';
import {
  renderChangelogPage,
  renderDeprecationsPage,
  renderRecipesPage,
  renderSdksPage,
  renderWebhooksPage,
} from '../lib/portal-content.js';

// The developer portal EXTENDS the shipped Scalar `/docs` reference with sibling
// documentation pages + the downloadable collections, all behind a default-off
// `module.developer-portal` flag (404 when off — ship-dark). The Scalar OpenAPI
// reference at `/docs` is left untouched.

function portalEnabled(): boolean {
  // Global surface, no calling tenant; the flag is global (default-off), so a
  // synthetic context suffices.
  return evaluate('module.developer-portal', {
    organizationId: 'developer-portal',
    region: 'EU',
  }).enabled;
}

function notFound(c: Context): Response {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint does not exist.',
        status: 404,
      },
    },
    404,
  );
}

/**
 * Register the developer-portal routes on the (already `/v1`-prefixed) app. Each
 * route 404s when `module.developer-portal` is off. The generated collections
 * derive from the live OpenAPI document, so they never drift from the spec.
 */
export function registerDeveloperPortal(app: OpenAPIHono): void {
  let postmanCache: unknown;
  let insomniaCache: unknown;
  const spec = () => buildOpenApiDocument(app) as unknown as Parameters<typeof generatePostman>[0];

  const html = (c: Context, render: () => string): Response =>
    portalEnabled() ? c.html(render()) : notFound(c);

  app.get('/docs/webhooks', c => html(c, renderWebhooksPage));
  app.get('/docs/sdks', c => html(c, renderSdksPage));
  app.get('/docs/recipes', c => html(c, renderRecipesPage));
  app.get('/docs/changelog', c => html(c, renderChangelogPage));
  app.get('/docs/deprecations', c => html(c, renderDeprecationsPage));

  app.get('/collections/postman.json', c => {
    if (!portalEnabled()) return notFound(c);
    postmanCache ??= generatePostman(spec());
    return c.json(postmanCache);
  });

  app.get('/collections/insomnia.json', c => {
    if (!portalEnabled()) return notFound(c);
    insomniaCache ??= generateInsomnia(spec());
    return c.json(insomniaCache);
  });
}
