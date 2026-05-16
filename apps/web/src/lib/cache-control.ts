// ---------------------------------------------------------------------------
// Phase C.7.a — explicit cache-control policy for public API routes.
// ---------------------------------------------------------------------------
//
// Every Route Handler under `apps/web/src/app/api/**` declares its caching
// posture explicitly so that:
//
//   1. CDNs and intermediary caches never accidentally cache org-scoped or
//      authenticated data,
//   2. Future static-prerender attempts by Next.js do not silently change
//      semantics for routes that read per-request state,
//   3. Any new route is forced to make a conscious decision documented in
//      `docs/CACHE-CONTROL.md`.
//
// The default is `no-store, private`. Routes that are genuinely cacheable
// (e.g. `/api/health`, `/.well-known/security.txt`) set their own stronger
// header (`public, max-age=60` / `public, max-age=3600`).
//
// Pino logger only — no console.* (CLAUDE.md).

/** Default Cache-Control for authenticated / org-scoped JSON responses. */
export const CACHE_CONTROL_NO_STORE = 'no-store, private' as const;

/** Cache-Control for the liveness probe — public, brief CDN cache to absorb monitor bursts. */
export const CACHE_CONTROL_HEALTH = 'public, max-age=60, must-revalidate' as const;

/**
 * Apply the default `no-store, private` Cache-Control header to a Response
 * and return the same instance. Idempotent — if the response already carries
 * a `Cache-Control` header (e.g. an upstream redirect helper set one), the
 * existing value is preserved so callers can opt into a stricter policy
 * without fighting this helper.
 */
export function withNoStore<T extends Response>(response: T): T {
  if (!response.headers.has('cache-control')) {
    response.headers.set('Cache-Control', CACHE_CONTROL_NO_STORE);
  }
  return response;
}
