import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

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
    redis: new Redis({ url: upstashUrl!, token: upstashToken! }),
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: false,
  });
}

// Per-IP limiters
const authLimiter = createLimiter(10, "1m"); // 10 auth requests per minute per IP
const portalLimiter = createLimiter(10, "1m"); // 10 portal requests per minute per IP
const apiLimiter = createLimiter(60, "1m"); // 60 API requests per minute per IP
// Per-org limiter
const orgLimiter = createLimiter(500, "1m"); // 500 requests per minute per org

// In-memory fallback when Redis is unavailable (dev / single-instance)
const fallbackMap = new Map<string, { count: number; resetAt: number }>();
const FALLBACK_WINDOW_MS = 60_000;

function fallbackRateLimit(key: string, max: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + FALLBACK_WINDOW_MS });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining };
}

// Periodic cleanup of expired fallback entries
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of fallbackMap) {
      if (now > entry.resetAt) fallbackMap.delete(key);
    }
  };
  setInterval(cleanup, 5 * 60_000).unref?.();
}

/**
 * Check rate limit using Redis (preferred) or in-memory fallback.
 * Returns { allowed, remaining } or null if an error occurred (fail-open).
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
    } catch {
      // Redis error: fail-open to avoid blocking all requests
      return { allowed: true, remaining: fallbackMax, limit: fallbackMax, reset: 0 };
    }
  }
  // No Redis: use in-memory fallback
  const fb = fallbackRateLimit(`${fallbackPrefix}:${identifier}`, fallbackMax);
  const entry = fallbackMap.get(`${fallbackPrefix}:${identifier}`);
  return { ...fb, limit: fallbackMax, reset: entry?.resetAt ?? 0 };
}

function rateLimitResponse(remaining: number, limit: number, reset: number) {
  const headers: Record<string, string> = {
    "Retry-After": "60",
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
  };

  if (reset > 0) {
    // Reset is a Unix timestamp in milliseconds from Upstash; convert to seconds for HTTP header
    headers["X-RateLimit-Reset"] = String(Math.ceil(reset / 1000));
  }

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers },
  );
}

const LOAD_TEST_HEADER = "x-load-test-secret";

/**
 * When LOAD_TEST_BYPASS=1 and LOAD_TEST_SECRET match the request header, skip
 * per-IP and per-org rate limits for /api/trpc (k6 / staging load tests).
 * Blocked on Vercel production. Never enable LOAD_TEST_BYPASS on public prod.
 */
function shouldSkipTrpcRateLimitForLoadTest(request: NextRequest): boolean {
  if (process.env.LOAD_TEST_BYPASS !== "1") return false;
  const secret = process.env.LOAD_TEST_SECRET?.trim();
  if (!secret) return false;
  if (process.env.VERCEL_ENV === "production") return false;
  const header = request.headers.get(LOAD_TEST_HEADER);
  return header === secret;
}

// ---------------------------------------------------------------------------
// Portal subdomain routing
// ---------------------------------------------------------------------------

/**
 * Base domain for portal subdomain routing.
 * Pattern: {slug}.{PORTAL_BASE_DOMAIN} -> resolves to org's portal.
 * Example: acme.portal.localhost:3000 or acme.portal.contractorops.com
 */
const PORTAL_BASE_DOMAIN = process.env.PORTAL_BASE_DOMAIN ?? "portal.localhost:3000";

/**
 * Auth route patterns (locale-prefixed).
 * These paths are only accessible to unauthenticated users.
 */
const AUTH_ROUTES = ["/login", "/register", "/verify-email"];

/**
 * Check if a pathname (after locale prefix) matches an auth route.
 */
function isAuthRoute(pathname: string): boolean {
  // Strip locale prefix: /en/login -> /login, /pl/register -> /register
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  return AUTH_ROUTES.some(
    (route) => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/** Public routes accessible without authentication */
const PUBLIC_ROUTES = ["/privacy", "/terms"];

function isPublicRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  return PUBLIC_ROUTES.some(
    (route) => withoutLocale === route || withoutLocale.startsWith(`${route}/`),
  );
}

/**
 * Check if a pathname is a dashboard route (not auth, not portal, not api, not public).
 */
function isDashboardRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  return (
    !isAuthRoute(pathname) &&
    !isPublicRoute(pathname) &&
    !withoutLocale.startsWith("/portal") &&
    !withoutLocale.startsWith("/invite") &&
    withoutLocale !== "/" // root redirect handled separately
  );
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
  const hostname = request.headers.get("host") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const pathname = request.nextUrl.pathname;

  // ── Rate limiting (API routes) ────────────────────────────────────────

  if (pathname.startsWith("/api/auth")) {
    const { allowed, remaining, limit, reset } = await checkLimit(authLimiter, ip, "auth", 10);
    if (!allowed) return rateLimitResponse(remaining, limit, reset);
  }

  if (pathname.startsWith("/api/portal")) {
    const { allowed, remaining, limit, reset } = await checkLimit(portalLimiter, ip, "portal", 10);
    if (!allowed) return rateLimitResponse(remaining, limit, reset);
  }

  if (pathname.startsWith("/api/trpc")) {
    if (!shouldSkipTrpcRateLimitForLoadTest(request)) {
      // Per-IP rate limit
      const ipResult = await checkLimit(apiLimiter, ip, "api", 60);
      if (!ipResult.allowed) return rateLimitResponse(ipResult.remaining, ipResult.limit, ipResult.reset);

      // Per-org rate limit (extract from session cookie → org cookie if available)
      const orgId = request.cookies.get("better-auth.active_organization")?.value;
      if (orgId) {
        const orgResult = await checkLimit(orgLimiter, orgId, "org", 500);
        if (!orgResult.allowed) return rateLimitResponse(orgResult.remaining, orgResult.limit, orgResult.reset);
      }
    }
  }

  // ── Portal subdomain routing ──────────────────────────────────────────

  if (hostname.endsWith(PORTAL_BASE_DOMAIN) && hostname !== PORTAL_BASE_DOMAIN) {
    const subdomain = hostname.replace(`.${PORTAL_BASE_DOMAIN}`, "");

    if (subdomain && !subdomain.includes(".")) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-portal-org-subdomain", subdomain);

      const url = request.nextUrl.clone();
      const subPathname = url.pathname;

      if (subPathname === "/" || subPathname === "") {
        url.pathname = "/en/portal";
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
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── Auth guards for non-portal routes ─────────────────────────────────

  const hasSession = request.cookies.has("better-auth.session_token");

  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  const locale = localeMatch?.[1] ?? "en";
  const pathWithoutLocale = localeMatch?.[2] ?? "/";

  if (!hasSession && isDashboardRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("redirectTo", pathWithoutLocale);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    const redirectTo = url.searchParams.get("redirectTo");
    url.pathname = redirectTo ? `/${locale}${redirectTo}` : `/${locale}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Default: next-intl middleware for non-portal requests
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except static files and internal Next.js paths.
  // API routes are included for rate limiting.
  matcher: ["/((?!monitoring|_next|_vercel|.*\\..*).*)", "/api/:path*"],
};
