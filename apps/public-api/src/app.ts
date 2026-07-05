import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { buildOpenApiDocument } from './lib/build-openapi-doc.js';
import { handleError } from './lib/error-handler.js';
import { observabilityMiddleware } from './lib/observability-middleware.js';
import { rateLimitMiddleware } from './lib/rate-limiter.js';
import { versionHeaders } from './lib/version-headers.js';
import auditLog from './routes/audit-log.js';
import classifications from './routes/classifications.js';
import complianceDocuments from './routes/compliance-documents.js';
import contractors from './routes/contractors.js';
import contracts from './routes/contracts.js';
import documents from './routes/documents.js';
import featureFlags from './routes/feature-flags.js';
import invoices from './routes/invoices.js';
import paymentRuns from './routes/payment-runs.js';
import payments from './routes/payments.js';
import workflowTasks from './routes/workflow-tasks.js';
import workflows from './routes/workflows.js';

// ---------------------------------------------------------------------------
// Public API v1 — OpenAPIHono host (OpenAPI 3.1 derived from route definitions)
// ---------------------------------------------------------------------------

const app = new OpenAPIHono().basePath('/v1');

/**
 * CORS allowlist — first-party origins only.
 *
 * Default `cors()` with no arguments returns `Access-Control-Allow-Origin: *`
 * which is unsafe for a Bearer-authenticated API: any browser extension or
 * XSS'd page could read a user's responses (and, with credentials disabled
 * but Authorization in custom headers, still burn the user's API key budget
 * by replaying requests).
 *
 * Source of truth:
 *   - PUBLIC_API_CORS_ORIGINS env var (comma-separated). Set via Render
 *     dashboard (sync: false in render.yaml) so per-env origins (prod app,
 *     staging app, preview deploys) can be rotated without a redeploy.
 *   - Production: env var is REQUIRED. Boot fails fast if unset to avoid
 *     accidentally shipping with the dev-only localhost default. The
 *     hardcoded BUILTIN_FIRST_PARTY_ORIGINS list is always merged in so
 *     the canonical first-party origins remain allowed even if an operator
 *     forgets to include them in the env var.
 *   - Development / test: env var is optional; defaults to localhost +
 *     first-party hosts (used by integration tests that don't bootstrap a
 *     full env).
 *
 * Wildcard subdomains (e.g. preview deploys) are not supported by Hono's
 * cors() origin matcher — list each origin explicitly. For staging
 * branches, add the specific origin to PUBLIC_API_CORS_ORIGINS per env.
 */
const BUILTIN_FIRST_PARTY_ORIGINS = [
  'https://app.contractor-ops.com',
  'https://contractor-ops.com',
] as const;

function parseAllowedOrigins(): Set<string> {
  const fromEnv = (process.env.PUBLIC_API_CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  if (process.env.NODE_ENV === 'production' && fromEnv.length === 0) {
    throw new Error(
      'PUBLIC_API_CORS_ORIGINS must be set in production. Configure ' +
        'comma-separated origins via the Render dashboard (sync: false in ' +
        'render.yaml). Refusing to boot with a permissive default to avoid ' +
        'shipping the dev-only localhost allowlist to prod.',
    );
  }

  return new Set<string>([
    ...BUILTIN_FIRST_PARTY_ORIGINS,
    ...fromEnv,
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
  ]);
}

const allowedOrigins = parseAllowedOrigins();

// --- Global middleware ---
// requestId MUST run before observabilityMiddleware so the latter can read
// `c.get('requestId')` and seed the AsyncLocalStorage frame.
app.use('*', requestId());
app.use('*', observabilityMiddleware);
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
app.use('*', versionHeaders);

// --- Routes ---
app.route('/contractors', contractors);
app.route('/invoices', invoices);
app.route('/contracts', contracts);
app.route('/documents', documents);
app.route('/feature-flags', featureFlags);
app.route('/payments', payments);
app.route('/payment-runs', paymentRuns);
app.route('/workflows', workflows);
app.route('/workflow-tasks', workflowTasks);
app.route('/classifications', classifications);
app.route('/compliance-documents', complianceDocuments);
app.route('/audit-log', auditLog);

// --- Health check (outside auth) ---
app.get('/health', c => c.json({ status: 'ok' }));

// --- OpenAPI spec (derived from route definitions — no hand-written literal) ---
app.get('/openapi.json', c => c.json(buildOpenApiDocument(app)));

// --- Interactive docs (Scalar via the vendored npm dep — no CDN/SRI) ---
app.get('/docs', Scalar({ url: '/v1/openapi.json' }));

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
