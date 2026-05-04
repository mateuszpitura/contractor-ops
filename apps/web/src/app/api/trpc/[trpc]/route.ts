import { appRouter, createContext } from '@contractor-ops/api';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

const log = createLogger({ service: 'http' });

// ---------------------------------------------------------------------------
// F-SCALE-17 — request body size cap
// ---------------------------------------------------------------------------
//
// tRPC's `fetchRequestHandler` does not enforce a body cap; Next.js' app
// router default is ~1 MB but can be lifted by callers. Some procedures
// accept large base64 payloads (invoice-intake fileBase64 ≈ 5 MB,
// import.contractors ≈ 10 MB). Without a hard ceiling, a misbehaving
// client (or an attacker) can post a multi-megabyte JSON body that the V8
// heap must materialize before Zod parses it — at 10-20 concurrent requests
// this is a 100-200 MB allocation spike that triggers GC pressure or OOMs
// on Render's `standard` (2 GB) tier.
//
// Cap is configurable via `TRPC_MAX_BODY_MB` (default 1 MB). Requests with
// a `Content-Length` header above the cap are short-circuited to 413 before
// the body is read — saves bandwidth and heap allocation. We don't try to
// guess size for chunked / no-CL requests; tRPC POSTs from our official
// clients always set Content-Length, and any client that strips it loses
// the optimisation but is still bounded by Next.js' upstream parser.
const MAX_BODY_MB = Math.max(1, Number.parseFloat(process.env.TRPC_MAX_BODY_MB ?? '1'));
const MAX_BODY_BYTES = Math.floor(MAX_BODY_MB * 1024 * 1024);

function tooLargeResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: -32600,
        message: `Request body exceeds ${MAX_BODY_MB} MB limit. Use presigned R2 uploads for large files.`,
        data: { httpStatus: 413 },
      },
    }),
    {
      status: 413,
      headers: { 'content-type': 'application/json' },
    },
  );
}

const handler = async (req: Request) => {
  const start = performance.now();
  const url = new URL(req.url);
  const method = req.method;
  const pathname = decodeURIComponent(url.pathname);
  const procedure = pathname.replace('/api/trpc/', '');
  const search = decodeURIComponent(url.search);

  // F-SCALE-17 — reject oversize bodies before fetchRequestHandler reads them.
  // Only POST/PUT/PATCH have bodies in tRPC's HTTP link.
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        log.warn(
          { method, procedure, contentLength, maxBytes: MAX_BODY_BYTES },
          '413 request body exceeds configured cap',
        );
        return tooLargeResponse();
      }
    }
  }

  log.info({ method, url: `${pathname}${search}`, procedure }, `→ ${method} ${pathname}${search}`);

  const res = await Sentry.withIsolationScope(() =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: () => createContext({ headers: req.headers }),
      onError({ error, path: procedurePath }) {
        Sentry.captureException(error, {
          tags: { 'trpc.path': procedurePath },
        });
      },
    }),
  );

  const durationMs = Math.round(performance.now() - start);
  const status = res.status;

  log.info(
    { method, url: `${pathname}${search}`, procedure, status, durationMs },
    `← ${method} ${pathname} ${status} ${durationMs}ms`,
  );

  // F-OBS-15 — RED metrics for the tRPC HTTP boundary so dashboards can
  // chart request rate, error rate, and latency P95 alongside the
  // per-procedure metrics already emitted in observability.ts. Tag set is
  // intentionally low-cardinality (route prefix, method, status class) to
  // avoid blowing up the metrics index.
  const statusClass = `${Math.floor(status / 100)}xx`;
  const route = '/api/trpc';
  metrics.increment('http.request.count', 1, {
    route,
    method,
    status: statusClass,
  });
  if (status >= 500) {
    metrics.increment('http.request.errors', 1, {
      route,
      method,
      status: statusClass,
    });
  }
  metrics.distribution('http.request.duration_ms', durationMs, {
    unit: 'millisecond',
    tags: { route, method, status: statusClass },
  });

  return res;
};

export { handler as GET, handler as POST };
