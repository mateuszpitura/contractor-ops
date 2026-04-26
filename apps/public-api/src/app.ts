import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { handleError } from './lib/error-handler.js';
import { rateLimitMiddleware } from './lib/rate-limiter.js';
import { openApiSpec } from './openapi.js';
import contractors from './routes/contractors.js';
import contracts from './routes/contracts.js';
import documents from './routes/documents.js';
import featureFlags from './routes/feature-flags.js';
import invoices from './routes/invoices.js';

// ---------------------------------------------------------------------------
// Public API v1
// ---------------------------------------------------------------------------

const app = new Hono().basePath('/api/v1');

/**
 * CORS allowlist — first-party origins only. Additional origins can be
 * added via PUBLIC_API_CORS_ORIGINS (comma-separated). Default `cors()`
 * with no arguments returns `Access-Control-Allow-Origin: *` which is
 * unsafe for a Bearer-authenticated API (any browser extension or
 * compromised page can burn a user's API key).
 */
const DEFAULT_CORS_ORIGINS = ['https://app.contractor-ops.com', 'https://contractor-ops.com'];

const envCorsOrigins = (process.env.PUBLIC_API_CORS_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(o => o.length > 0);

const allowedOrigins = new Set<string>([
  ...DEFAULT_CORS_ORIGINS,
  ...envCorsOrigins,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
]);

// --- Global middleware ---
app.use('*', requestId());
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }),
);
app.use(
  '*',
  cors({
    origin: origin => (origin && allowedOrigins.has(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposeHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    credentials: false,
    maxAge: 600,
  }),
);
app.use('*', rateLimitMiddleware);

// --- Routes ---
app.route('/contractors', contractors);
app.route('/invoices', invoices);
app.route('/contracts', contracts);
app.route('/documents', documents);
app.route('/feature-flags', featureFlags);

// --- Health check (outside auth) ---
app.get('/health', c => c.json({ status: 'ok' }));

// --- OpenAPI spec ---
app.get('/openapi.json', c => c.json(openApiSpec));

// --- Interactive docs ---
// Gated behind ENABLE_API_DOCS. Disabled by default so forgetting to pin
// a real SRI hash can't result in a broken (or, worse, silently compromised)
// public docs page. When enabled, the server fails fast at startup if the
// SRI hash is still the placeholder — better to refuse to boot than to
// serve an unverified 3rd-party script.
const DOCS_ENABLED = process.env.ENABLE_API_DOCS === 'true';
const SCALAR_VERSION = '1.25.28';
// Regenerate when bumping SCALAR_VERSION:
//   curl -sL https://cdn.jsdelivr.net/npm/@scalar/api-reference@<ver>/dist/browser/standalone.js \
//     | openssl dgst -sha384 -binary | openssl base64 -A
const SCALAR_SRI_PLACEHOLDER = 'sha384-REPLACE_WITH_PINNED_HASH_BEFORE_ENABLING_IN_PROD';
const SCALAR_SRI = process.env.SCALAR_SRI_HASH ?? SCALAR_SRI_PLACEHOLDER;

if (DOCS_ENABLED && SCALAR_SRI === SCALAR_SRI_PLACEHOLDER) {
  throw new Error(
    'ENABLE_API_DOCS=true but SCALAR_SRI_HASH is the placeholder. ' +
      'Pin a real subresource-integrity hash for @scalar/api-reference@' +
      SCALAR_VERSION +
      ' before enabling /docs. ' +
      'See apps/public-api/src/app.ts for the regen command.',
  );
}

if (DOCS_ENABLED) {
  app.get('/docs', c => {
    const scriptUrl = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}/dist/browser/standalone.js`;

    const csp = [
      "default-src 'none'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com https://cdn.jsdelivr.net',
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');

    c.header('Content-Security-Policy', csp);

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Contractor Ops API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/v1/openapi.json"></script>
  <script
    src="${scriptUrl}"
    integrity="${SCALAR_SRI}"
    crossorigin="anonymous"></script>
</body>
</html>`;
    return c.html(html);
  });
}

// --- Error handler ---
app.onError(handleError);

// --- 404 ---
app.notFound(c =>
  c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint does not exist.',
        status: 404,
      },
    },
    404,
  ),
);

export default app;
