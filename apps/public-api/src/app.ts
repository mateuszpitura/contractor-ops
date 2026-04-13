import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { handleError } from './lib/error-handler.js';
import { rateLimitMiddleware } from './lib/rate-limiter.js';
import contractors from './routes/contractors.js';
import contracts from './routes/contracts.js';
import documents from './routes/documents.js';
import invoices from './routes/invoices.js';

// ---------------------------------------------------------------------------
// Public API v1
// ---------------------------------------------------------------------------

const app = new Hono().basePath('/api/v1');

// --- Global middleware ---
app.use('*', requestId());
app.use('*', cors());
app.use('*', rateLimitMiddleware);

// --- Routes ---
app.route('/contractors', contractors);
app.route('/invoices', invoices);
app.route('/contracts', contracts);
app.route('/documents', documents);

// --- Health check (outside auth) ---
app.get('/health', c => c.json({ status: 'ok' }));

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
