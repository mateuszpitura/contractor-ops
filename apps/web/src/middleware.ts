import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
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

// Sentry alert debounce for Upstash Redis miss. During a Redis outage, the
// miss path is hit on every request → without throttling this floods Sentry
// quota with thousands of identical alerts per minute. Breadcrumbs are still
// added on every miss (cheap, no quota cost) so the full context is attached
// to any exception that does fire.
let lastUpstashRedisAlertAt = 0;
const UPSTASH_ALERT_INTERVAL_MS = 60_000;

function createLimiter(maxRequests: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!hasRedis) return null;
  return new Ratelimit({
    redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: false,
  });
}

// Per-IP limiters
//
// Auth endpoints (/api/auth/*) are NOT rate-limited at the edge. Better Auth
// has its own granular per-endpoint rate limiter (10/min sign-in, 5/min
// sign-up, etc.), per-account lockout (5 failed → 15min lock), and Turnstile
// CAPTCHA on sign-up. Those three layers are strictly superior to a blanket
// edge counter that can't distinguish endpoints or success/failure. The
// previous edge auth limiter starved legitimate session polling and blocked
// sign-out/re-login flows — adding complexity to work around it (exemptions,
// counter resets) would duplicate what Better Auth already does better.
const isDev = (process.env.NODE_ENV ?? 'development') === 'development';
const portalLimiter = isDev ? null : createLimiter(10, '1m'); // 10 portal requests per minute per IP
const apiLimiter = isDev ? null : createLimiter(60, '1m'); // 60 API requests per minute per IP
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
      // Always add a breadcrumb (free) so the next captured exception carries
      // the full miss-context. Only fire the captureMessage alert at most once
      // per UPSTASH_ALERT_INTERVAL_MS to avoid burning Sentry quota during an
      // extended Redis outage.
      Sentry.addBreadcrumb({
        category: 'rate-limit',
        level: 'warning',
        message: 'upstash rate limiter unavailable — falling back to in-memory',
        data: { limiter: fallbackPrefix, env, error: String(err) },
      });
      const now = Date.now();
      if (now - lastUpstashRedisAlertAt > UPSTASH_ALERT_INTERVAL_MS) {
        lastUpstashRedisAlertAt = now;
        Sentry.captureMessage('upstash rate limiter unavailable — falling back to in-memory', {
          level: 'warning',
          tags: { component: 'edge-middleware', limiter: fallbackPrefix, env },
        });
      }
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
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
  return AUTH_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/** Public routes accessible without authentication */
const PUBLIC_ROUTES = ['/legal'];

function isPublicRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
  return PUBLIC_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/**
 * Check if a pathname is a dashboard route (not auth, not portal, not api, not public).
 */
function isDashboardRoute(pathname: string): boolean {
  // Strip locale prefix: /en/contractors -> /contractors, /en -> /
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
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
  // Skip rate limiting entirely in development — all requests come from
  // 127.0.0.1 and the in-memory fallback quickly exhausts the 60 req/min
  // budget with normal dashboard polling (notifications, approvals, time).
  if (isDev) return null;

  try {
    // Auth endpoints (/api/auth/*) are intentionally NOT rate-limited here.
    // Better Auth handles this internally with per-endpoint caps + account
    // lockout + Turnstile — see packages/auth/src/config.ts.

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
/**
 * F-OBS-09 — mint `x-request-id` at the edge when the upstream caller did
 * not supply one, and forward it on the request headers so every downstream
 * handler (Better Auth catch-all, tRPC HTTP route, webhook routes, RSC) sees
 * one stable id per HTTP call. Combined with `buildContextFromHeaders` +
 * `runWithRequestContext` at each route entrypoint, this gives us a single
 * correlation id across Pino logs, Sentry events, and outbound integration
 * HTTP for the lifetime of the request.
 *
 * `crypto.randomUUID()` is available in the Edge Runtime; using UUID v4 here
 * keeps the edge mint cheap and avoids pulling the UUID v7 helper (which
 * lives in the Node-only logger package).
 */
function ensureRequestIdHeader(request: NextRequest): {
  headers: Headers;
  requestId: string;
  minted: boolean;
} {
  const incoming = request.headers.get('x-request-id')?.trim();
  if (incoming) {
    return { headers: request.headers, requestId: incoming, minted: false };
  }
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  return { headers, requestId, minted: true };
}

// ---------------------------------------------------------------------------
// CSP nonce (preparing for C.1.c enforce flip — production-hardening §10.5)
// ---------------------------------------------------------------------------

/**
 * Per-request base64 nonce, used in the enforce CSP `script-src` so
 * `next-themes`' pre-hydration inline script can carry `nonce={NONCE}` and
 * pass under `'strict-dynamic'`. Pre-flip (C.1.b) this fed the report-only
 * header; post-flip (C.1.c) the same nonce drives the enforce policy and
 * `'unsafe-inline'` is gone from script-src.
 *
 * Edge Runtime exposes `crypto.getRandomValues` (Web Crypto) but NOT Node's
 * `crypto.randomBytes`. The 16-byte source is base64-encoded via `btoa` for
 * a 24-character CSP token — long enough that brute-force is intractable.
 */
function mintCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

// C.1.c — enforce CSP body (was report-only during 2026-05 observation
// window; flipped to enforce on 2026-05-17 since app has never been
// deployed and no users could be broken by a strict policy).
// 'unsafe-inline' removed from script-src; per-request nonce + 'strict-
// dynamic' allow only next-themes' pre-hydration script and any other
// script that explicitly receives the matching nonce attribute.
/**
 * Build the enforce CSP body with the per-request nonce interpolated into
 * `script-src`. Directive set:
 *   - `'nonce-${nonce}' 'strict-dynamic'` on script-src — only scripts that
 *     carry the matching nonce (and any they dynamically load) execute. No
 *     `'unsafe-inline'`.
 *   - `https://unpkg.com` retained on script-src/connect-src for the OCR
 *     worker bundle (loaded lazily from unpkg in dev/staging mirrors).
 *   - `report-uri` + `report-to` retained — violations now blocked AND
 *     logged so the Pino+Sentry pipeline still surfaces unexpected blocks
 *     for debugging.
 *
 * `'unsafe-inline'` stays on style-src — Next.js + Tailwind ship inline
 * `<style>` tags and adopting a hashed/nonce style pipeline is out of scope
 * for this commit. Tracked separately.
 */
function buildCsp(nonce: string, isDevEnv: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevEnv ? " 'unsafe-eval'" : ''} https://unpkg.com https://*.sentry-cdn.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.googleusercontent.com https://graph.microsoft.com",
    "connect-src 'self' https://*.docusign.com https://unpkg.com https://*.sentry.io https://*.ingest.sentry.io",
    "frame-src 'self' https://*.docusign.com https://*.docusign.net https://apps-d.docusign.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

/**
 * Attach the per-request enforce `Content-Security-Policy` header (with the
 * interpolated nonce) to whatever response the middleware is about to emit.
 * Mutates `response.headers` in place and returns the same instance for
 * call-site chaining.
 *
 * Why here rather than next.config.ts headers()? — the nonce must change per
 * request and `headers()` is evaluated once at config time. Setting CSP on
 * the middleware response is the only way to thread a fresh nonce into every
 * navigation/RSC payload. The static `Content-Security-Policy` entry in
 * next.config.ts was removed in C.1.c; this function now owns the header.
 */
function attachCsp(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCsp(nonce, isDev));
  return response;
}

export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  // F-SEC-17: walk the X-Forwarded-For chain right-to-left, terminating at
  // the first untrusted hop. The leftmost entry is attacker-controlled when
  // the request lands on a misconfigured proxy chain.
  const ip = extractClientIp(request);
  const pathname = request.nextUrl.pathname;

  // F-OBS-09 — mint or pass-through the request correlation id. The same
  // Headers instance is forwarded on every NextResponse below so the id
  // reaches both auth and tRPC handlers.
  const { headers: requestIdHeaders, minted } = ensureRequestIdHeader(request);

  // C.1.c prep — mint a fresh CSP nonce per request and forward it via the
  // `x-nonce` request header so Server Components can read it through
  // `headers()` and pass it to <ThemeProvider nonce={...}> (next-themes
  // injects a pre-hydration inline script that needs the matching attribute).
  const nonce = mintCspNonce();
  const forwardHeaders = minted ? new Headers(requestIdHeaders) : new Headers(request.headers);
  forwardHeaders.set('x-nonce', nonce);
  const forwardInit = { request: { headers: forwardHeaders } };

  // ── Rate limiting (API routes) ────────────────────────────────────────

  const rateLimitResult = await applyRateLimits(pathname, ip, request);
  if (rateLimitResult) return attachCsp(rateLimitResult, nonce);

  // ── Portal subdomain routing ──────────────────────────────────────────

  if (hostname.endsWith(PORTAL_BASE_DOMAIN) && hostname !== PORTAL_BASE_DOMAIN) {
    const subdomain = hostname.replace(`.${PORTAL_BASE_DOMAIN}`, '');

    if (subdomain && !subdomain.includes('.')) {
      // Start from the (mint-augmented + nonce-augmented) forward headers so
      // the request id and nonce ride along on the portal rewrite/next path.
      const requestHeaders = new Headers(forwardHeaders);
      requestHeaders.set('x-portal-org-subdomain', subdomain);

      const url = request.nextUrl.clone();
      const subPathname = url.pathname;

      if (subPathname === '/' || subPathname === '') {
        url.pathname = '/en/portal';
        return attachCsp(
          NextResponse.rewrite(url, {
            request: { headers: requestHeaders },
          }),
          nonce,
        );
      }

      return attachCsp(
        NextResponse.next({
          request: { headers: requestHeaders },
        }),
        nonce,
      );
    }
  }

  // ── API routes: skip auth guards and intl (rate limiting already handled above)
  if (pathname.startsWith('/api/')) {
    return attachCsp(NextResponse.next(forwardInit), nonce);
  }

  // ── Auth guards for non-portal routes ─────────────────────────────────

  const authRedirect = applyAuthGuards(request, pathname);
  if (authRedirect) return attachCsp(authRedirect, nonce);

  // Default: next-intl middleware for non-portal requests. We always hand
  // next-intl the augmented headers (request id + nonce) so locale negotiation
  // and any RSC render reachable via this branch sees both. The API
  // boundaries that actually thread the id into ALS (auth, tRPC, webhooks)
  // are covered by the explicit `/api/*` branch above.
  const mintedRequest = new NextRequest(request, { headers: forwardHeaders });
  return attachCsp(intlMiddleware(mintedRequest), nonce);
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
