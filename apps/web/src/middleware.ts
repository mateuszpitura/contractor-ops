import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import proxyAddr from 'proxy-addr';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// ---------------------------------------------------------------------------
// Rate limiting (Upstash Redis with in-memory fallback)
// ---------------------------------------------------------------------------

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(upstashUrl && upstashToken);

function createLimiter(maxRequests: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!hasRedis) return null;
  return new Ratelimit({
    redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: false,
  });
}

// Per-IP limiters
const authLimiter = createLimiter(10, '1m'); // 10 auth requests per minute per IP
const portalLimiter = createLimiter(10, '1m'); // 10 portal requests per minute per IP
const apiLimiter = createLimiter(60, '1m'); // 60 API requests per minute per IP
// NOTE: Per-org rate limiting used to key on the `better-auth.active_organization`
// cookie, but that cookie is client-editable — an attacker can trivially
// rotate the value to escape their bucket, making the limit unenforceable
// at the edge. Per-org caps are enforced downstream at the tRPC layer where
// the session (and thus org membership) has been cryptographically validated
// by Better Auth. See packages/api/src/middleware/tenant.ts.

// In-memory fallback when Redis is unavailable (dev / single-instance).
// Cleanup is done on-access (lazy) rather than via setInterval — the edge
// runtime is short-lived and reloads the module frequently, so a periodic
// timer is mostly decorative and can leak across HMR reloads.
//
// F-SCALE-15 — eviction is LRU on `lastSeenMs`, not insertion-order FIFO.
// During a Redis outage the prior FIFO behaviour evicted the first-
// arriving legitimate users while preserving later-arriving low-rate
// attackers; LRU keeps the active workload pinned and pushes stale keys
// out. The `count` resets on window expiry independently of LRU position.
type EdgeFallbackEntry = { count: number; resetAt: number; lastSeenMs: number };
const fallbackMap = new Map<string, EdgeFallbackEntry>();
const FALLBACK_WINDOW_MS = 60_000;
const FALLBACK_MAX_ENTRIES = 10_000;

function evictOldestLruFallbackEntry(): void {
  let oldestKey: string | undefined;
  let oldestSeen = Number.POSITIVE_INFINITY;
  for (const [k, v] of fallbackMap) {
    if (v.lastSeenMs < oldestSeen) {
      oldestSeen = v.lastSeenMs;
      oldestKey = k;
    }
  }
  if (oldestKey) fallbackMap.delete(oldestKey);
}

function fallbackRateLimit(key: string, max: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    if (fallbackMap.size >= FALLBACK_MAX_ENTRIES) {
      // Drop the oldest 10 % by `lastSeenMs` — true LRU rather than the
      // FIFO proxy that lived here before. Sweeping 10% in one pass keeps
      // amortised cost low at the cost of one extra full-map scan per
      // batch.
      const toEvict = Math.ceil(FALLBACK_MAX_ENTRIES * 0.1);
      for (let i = 0; i < toEvict; i++) {
        evictOldestLruFallbackEntry();
      }
    }
    fallbackMap.set(key, { count: 1, resetAt: now + FALLBACK_WINDOW_MS, lastSeenMs: now });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  entry.lastSeenMs = now;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining };
}

/**
 * Sentinel error thrown by `checkLimit` when the Upstash backend is
 * unavailable in production (F-SCALE-03). Callers translate this into a
 * 503 + Retry-After response so the request fails CLOSED rather than
 * letting an attacker bypass auth/portal/api throttles during a Redis
 * outage.
 */
class RateLimiterUnavailableError extends Error {
  constructor() {
    super('rate limiter backend unavailable');
    this.name = 'RateLimiterUnavailableError';
  }
}

/**
 * Check rate limit using Redis (preferred) or in-memory fallback.
 *
 * On Upstash error:
 *   - production → throws `RateLimiterUnavailableError` so the caller can
 *     fail-CLOSED with a 503 + Retry-After. Allowing every request through
 *     during a Redis outage hands attackers a free DoS / credential-
 *     stuffing window against /api/auth, /api/portal, /api/trpc.
 *   - dev/test   → falls back to the in-memory counter so local dev keeps
 *     working when Redis isn't available, and emits a Sentry warning so
 *     the drift is visible (Pino is unavailable in the edge runtime).
 */
async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
  fallbackPrefix: string,
  fallbackMax: number,
): Promise<{ allowed: boolean; remaining: number; limit: number; reset: number }> {
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        limit: result.limit,
        reset: result.reset,
      };
    } catch (err) {
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        // Fail-closed in production. Capture for on-call visibility.
        Sentry.captureException(err, {
          level: 'error',
          tags: { component: 'edge-middleware', limiter: fallbackPrefix },
          extra: { reason: 'upstash unavailable; failing closed' },
        });
        throw new RateLimiterUnavailableError();
      }
      Sentry.captureMessage('upstash rate limiter unavailable — falling back to in-memory', {
        level: 'warning',
        tags: { component: 'edge-middleware', limiter: fallbackPrefix, env },
      });
      const fb = fallbackRateLimit(`${fallbackPrefix}:${identifier}`, fallbackMax);
      const entry = fallbackMap.get(`${fallbackPrefix}:${identifier}`);
      return { ...fb, limit: fallbackMax, reset: entry?.resetAt ?? 0 };
    }
  }
  // No Redis configured: use in-memory fallback
  const fb = fallbackRateLimit(`${fallbackPrefix}:${identifier}`, fallbackMax);
  const entry = fallbackMap.get(`${fallbackPrefix}:${identifier}`);
  return { ...fb, limit: fallbackMax, reset: entry?.resetAt ?? 0 };
}

/**
 * 503 response when the rate-limit backend is unavailable in production.
 * Retry-After is short (5 s) so well-behaved clients back off briefly while
 * Upstash recovers, rather than queueing indefinitely.
 */
function rateLimiterUnavailableResponse() {
  return NextResponse.json(
    { error: 'Service temporarily unavailable. Please retry in a moment.' },
    {
      status: 503,
      headers: { 'Retry-After': '5' },
    },
  );
}

function rateLimitResponse(remaining: number, limit: number, reset: number) {
  const headers: Record<string, string> = {
    'Retry-After': '60',
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
  };

  if (reset > 0) {
    // Reset is a Unix timestamp in milliseconds from Upstash; convert to seconds for HTTP header
    headers['X-RateLimit-Reset'] = String(Math.ceil(reset / 1000));
  }

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers },
  );
}

const LOAD_TEST_HEADER = 'x-load-test-secret';

/**
 * Constant-time byte compare for secret verification. Uses TextEncoder
 * (edge-runtime safe) to avoid pulling node:crypto, and returns early-false
 * on length mismatch without leaking timing about the prefix.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * When LOAD_TEST_BYPASS=1 and LOAD_TEST_SECRET match the request header, skip
 * per-IP rate limits for /api/trpc (k6 / staging load tests).
 * Hard-blocked on production hosts (Vercel prod, Render non-preview). Never
 * enable LOAD_TEST_BYPASS on a public production service.
 *
 * The secret compare is constant-time to avoid leaking the secret through a
 * timing side-channel — belt-and-braces, since the env guards already block
 * use of this header in production.
 */
function shouldSkipTrpcRateLimitForLoadTest(request: NextRequest): boolean {
  if (process.env.LOAD_TEST_BYPASS !== '1') return false;
  const secret = process.env.LOAD_TEST_SECRET?.trim();
  if (!secret) return false;
  if (process.env.VERCEL_ENV === 'production') return false;
  // Render sets RENDER=true on every service; IS_PULL_REQUEST=false on the
  // non-preview (production) branch. Block bypass there.
  if (process.env.RENDER === 'true' && process.env.IS_PULL_REQUEST !== 'true') return false;
  const header = request.headers.get(LOAD_TEST_HEADER);
  if (!header) return false;
  return constantTimeEquals(header, secret);
}

// ---------------------------------------------------------------------------
// Trusted-proxy / client-IP extraction (F-SEC-17)
// ---------------------------------------------------------------------------

/**
 * Comma-separated list of trusted proxy CIDRs / IPs. Configured via
 * `TRUSTED_PROXIES` env var. Examples:
 *   - Render: "10.0.0.0/8,loopback" (Render's internal proxies live in 10/8;
 *     loopback covers the local agent socket).
 *   - Vercel: "uniquelocal" (the proxy is a sidecar on the same node).
 *
 * Falls back to "loopback,linklocal,uniquelocal" when unset, which is the
 * conservative pre-Render-pin default. Document the production value in
 * .env.example. Misconfiguring this allows X-Forwarded-For spoofing
 * (F-SEC-17): when the trust list is too permissive, a remote attacker
 * supplies their own XFF entry and our rate-limiter sees a fresh IP per
 * request.
 */
const TRUSTED_PROXIES_RAW = process.env.TRUSTED_PROXIES ?? 'loopback,linklocal,uniquelocal';
const TRUSTED_PROXIES_LIST = TRUSTED_PROXIES_RAW.split(',')
  .map(p => p.trim())
  .filter(Boolean);

/**
 * Extract the trusted client IP via `proxy-addr`. Walks the X-Forwarded-For
 * chain right-to-left and stops at the first untrusted hop — i.e. the last
 * IP added by a trusted proxy is taken as the real client. This closes the
 * F-SEC-17 spoofing window where a remote attacker prepends arbitrary
 * IPs to bypass per-IP rate limits.
 *
 * `proxy-addr` expects an `req` with `connection.remoteAddress` and
 * `headers`. The Next.js edge runtime does not expose `connection.remoteAddress`,
 * so we fall back to `x-real-ip` (set by Render/Vercel/Cloudflare proxies)
 * before the XFF walk.
 */
function extractClientIp(request: NextRequest): string {
  // proxy-addr needs a Node-shaped req; build a minimal adapter from
  // NextRequest. The package only reads `headers[name]` and
  // `connection.remoteAddress` so we wire just those.
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const adapter = {
    headers,
    connection: {
      // The edge runtime hides the socket address; `x-real-ip` is what the
      // platform proxy sets after stripping inbound XFF spoofing. Use it as
      // the seed when the socket address is unavailable.
      remoteAddress: request.headers.get('x-real-ip') ?? '127.0.0.1',
    },
  } as unknown as Parameters<typeof proxyAddr>[0];

  try {
    const ip = proxyAddr(adapter, TRUSTED_PROXIES_LIST);
    return ip || 'unknown';
  } catch {
    // proxy-addr throws on invalid CIDR notation; log via Sentry rather than
    // failing the request — but we keep an ultimate fallback so rate-limit
    // still functions (just with potentially-spoofable values).
    Sentry.captureMessage('proxy-addr threw on TRUSTED_PROXIES parse', {
      level: 'warning',
      tags: { component: 'edge-middleware' },
      extra: { trustedProxies: TRUSTED_PROXIES_RAW },
    });
    return (
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
      'unknown'
    );
  }
}

// ---------------------------------------------------------------------------
// Portal subdomain routing
// ---------------------------------------------------------------------------

/**
 * Base domain for portal subdomain routing.
 * Pattern: {slug}.{PORTAL_BASE_DOMAIN} -> resolves to org's portal.
 * Example: acme.portal.localhost:3000 or acme.portal.contractorops.com
 */
const PORTAL_BASE_DOMAIN = process.env.PORTAL_BASE_DOMAIN ?? 'portal.localhost:3000';

/**
 * Auth route patterns (locale-prefixed).
 * These paths are only accessible to unauthenticated users.
 */
const AUTH_ROUTES = ['/login', '/register', '/verify-email'];

/**
 * Check if a pathname (after locale prefix) matches an auth route.
 */
function isAuthRoute(pathname: string): boolean {
  // Strip locale prefix: /en/login -> /login, /pl/register -> /register
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  return AUTH_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/** Public routes accessible without authentication */
const PUBLIC_ROUTES = ['/privacy', '/terms'];

function isPublicRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  return PUBLIC_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/**
 * Check if a pathname is a dashboard route (not auth, not portal, not api, not public).
 */
function isDashboardRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
  return (
    !(
      isAuthRoute(pathname) ||
      isPublicRoute(pathname) ||
      withoutLocale.startsWith('/portal') ||
      withoutLocale.startsWith('/invite')
    ) && withoutLocale !== '/' // root redirect handled separately
  );
}

// ---------------------------------------------------------------------------
// Auth guard dispatcher (extracted to reduce middleware complexity)
// ---------------------------------------------------------------------------

/**
 * Cheap cookie-shape guard. The Better Auth session-token cookie is a signed
 * JWT-like string; a client-forged empty or obviously-malformed value can
 * satisfy `cookies.has()` but is clearly not a real session.
 *
 * The authoritative session validation runs inside the tRPC context and in
 * server-component layouts (see packages/api/src/context.ts and each
 * dashboard layout). This middleware guard exists only to drive the
 * unauthenticated UX redirect — it must NEVER be the sole gate on a
 * protected route. Add a session check in every dashboard `layout.tsx`.
 */
function hasSessionCookie(request: NextRequest): boolean {
  const raw = request.cookies.get('better-auth.session_token')?.value;
  if (!raw) return false;
  // Minimum plausible length for a Better Auth signed session token. Real
  // tokens are ~50+ chars; anything shorter is almost certainly a forgery.
  if (raw.length < 20) return false;
  // Must be URL-safe base64-ish (letters, digits, `-_.~+/=`).
  if (!/^[A-Za-z0-9._\-~+/=]+$/.test(raw)) return false;
  return true;
}

function applyAuthGuards(request: NextRequest, pathname: string): NextResponse | null {
  const hasSession = hasSessionCookie(request);
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  const locale = localeMatch?.[1] ?? 'en';
  const pathWithoutLocale = localeMatch?.[2] ?? '/';

  if (!hasSession && isDashboardRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set('redirectTo', pathWithoutLocale);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    const redirectTo = url.searchParams.get('redirectTo');
    url.pathname = redirectTo ? `/${locale}${redirectTo}` : `/${locale}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rate limit dispatcher (extracted to reduce middleware complexity)
// ---------------------------------------------------------------------------

async function applyRateLimits(
  pathname: string,
  ip: string,
  request: NextRequest,
): Promise<NextResponse | null> {
  try {
    if (pathname.startsWith('/api/auth')) {
      const { allowed, remaining, limit, reset } = await checkLimit(authLimiter, ip, 'auth', 10);
      if (!allowed) return rateLimitResponse(remaining, limit, reset);
    }

    if (pathname.startsWith('/api/portal')) {
      const { allowed, remaining, limit, reset } = await checkLimit(
        portalLimiter,
        ip,
        'portal',
        10,
      );
      if (!allowed) return rateLimitResponse(remaining, limit, reset);
    }

    if (pathname.startsWith('/api/trpc') && !shouldSkipTrpcRateLimitForLoadTest(request)) {
      const ipResult = await checkLimit(apiLimiter, ip, 'api', 60);
      if (!ipResult.allowed)
        return rateLimitResponse(ipResult.remaining, ipResult.limit, ipResult.reset);

      // Per-org rate limiting intentionally removed: the only org identifier
      // available in the edge runtime is the `better-auth.active_organization`
      // cookie, which is client-editable. Per-org caps live in the tRPC
      // middleware where the session has been validated server-side.
    }
  } catch (err) {
    // F-SCALE-03: rate limiter unavailable in production → fail-CLOSED with
    // 503 + Retry-After. The Sentry capture happens inside `checkLimit` so
    // we don't double-report here.
    if (err instanceof RateLimiterUnavailableError) {
      return rateLimiterUnavailableResponse();
    }
    throw err;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Combined middleware
// ---------------------------------------------------------------------------

/**
 * Combined middleware: rate limiting + auth guards + portal subdomain routing + next-intl i18n.
 *
 * 1. Rate limits API endpoints (per-IP + per-org).
 * 2. Checks for portal subdomain pattern and rewrites accordingly.
 * 3. Redirects unauthenticated users from dashboard routes to /login.
 * 4. Redirects authenticated users from auth routes to / (or redirectTo param).
 * 5. Falls through to next-intl middleware for i18n.
 */
export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  // F-SEC-17: walk the X-Forwarded-For chain right-to-left, terminating at
  // the first untrusted hop. The leftmost entry is attacker-controlled when
  // the request lands on a misconfigured proxy chain.
  const ip = extractClientIp(request);
  const pathname = request.nextUrl.pathname;

  // ── Rate limiting (API routes) ────────────────────────────────────────

  const rateLimitResult = await applyRateLimits(pathname, ip, request);
  if (rateLimitResult) return rateLimitResult;

  // ── Portal subdomain routing ──────────────────────────────────────────

  if (hostname.endsWith(PORTAL_BASE_DOMAIN) && hostname !== PORTAL_BASE_DOMAIN) {
    const subdomain = hostname.replace(`.${PORTAL_BASE_DOMAIN}`, '');

    if (subdomain && !subdomain.includes('.')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-portal-org-subdomain', subdomain);

      const url = request.nextUrl.clone();
      const subPathname = url.pathname;

      if (subPathname === '/' || subPathname === '') {
        url.pathname = '/en/portal';
        return NextResponse.rewrite(url, {
          request: { headers: requestHeaders },
        });
      }

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  // ── API routes: skip auth guards and intl (rate limiting already handled above)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Auth guards for non-portal routes ─────────────────────────────────

  const authRedirect = applyAuthGuards(request, pathname);
  if (authRedirect) return authRedirect;

  // Default: next-intl middleware for non-portal requests
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except static files and internal Next.js paths.
  // API routes are included for rate limiting.
  matcher: ['/((?!monitoring|_next|_vercel|.*\\..*).*)', '/api/:path*'],
};

// ---------------------------------------------------------------------------
// F-SCALE-19 — QStash queue-depth backpressure (implemented)
// ---------------------------------------------------------------------------
// Landed in commits 0cb3cb75, 6f8763ac, 5b1657fd. The end-to-end pipeline:
//   • Per-topic concurrency caps + per-pod Redis semaphores live in
//     packages/api/src/services/qstash-backpressure.ts.
//   • Queue-depth probe is exposed via /api/health (warns to Sentry above
//     the configured threshold).
// See packages/api/src/services/qstash-backpressure.ts for the source of
// truth; this comment is left as a breadcrumb for readers tracing
// rate-limit / dispatch behaviour from the middleware entrypoint.
