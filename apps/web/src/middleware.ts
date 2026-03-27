import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// ---------------------------------------------------------------------------
// In-memory rate limiter (per-IP, sliding window)
// For production, replace with Redis-based solution (e.g. @upstash/ratelimit).
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_AUTH = 10; // max 10 auth requests per minute per IP
const RATE_LIMIT_MAX_API = 60; // max 60 API requests per minute per IP

function checkRateLimit(
  ip: string,
  prefix: string,
  max: number,
): { allowed: boolean; remaining: number } {
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining };
}

// Periodic cleanup of expired entries (every 5 minutes)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  };
  setInterval(cleanup, 5 * 60_000).unref?.();
}

/**
 * Base domain for portal subdomain routing.
 * Pattern: {slug}.{PORTAL_BASE_DOMAIN} -> resolves to org's portal.
 * Example: acme.portal.localhost:3000 or acme.portal.contractorops.com
 */
const PORTAL_BASE_DOMAIN =
  process.env.PORTAL_BASE_DOMAIN ?? "portal.localhost:3000";

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

/**
 * Check if a pathname is a dashboard route (not auth, not portal, not api).
 */
function isDashboardRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");
  return (
    !isAuthRoute(pathname) &&
    !withoutLocale.startsWith("/portal") &&
    !withoutLocale.startsWith("/invite") &&
    withoutLocale !== "/" // root redirect handled separately
  );
}

/**
 * Combined middleware: auth guards + portal subdomain routing + next-intl i18n.
 *
 * 1. Checks for portal subdomain pattern and rewrites accordingly.
 * 2. Redirects unauthenticated users from dashboard routes to /login.
 * 3. Redirects authenticated users from auth routes to / (or redirectTo param).
 * 4. Falls through to next-intl middleware for i18n.
 */
export default function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const pathname = request.nextUrl.pathname;

  // Rate limit auth API endpoints (login, register, magic link)
  if (pathname.startsWith("/api/auth")) {
    const { allowed, remaining } = checkRateLimit(ip, "auth", RATE_LIMIT_MAX_AUTH);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      );
    }
  }

  // Rate limit portal session endpoint
  if (pathname.startsWith("/api/portal")) {
    const { allowed, remaining } = checkRateLimit(ip, "portal", RATE_LIMIT_MAX_AUTH);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      );
    }
  }

  // Rate limit tRPC API
  if (pathname.startsWith("/api/trpc")) {
    const { allowed, remaining } = checkRateLimit(ip, "api", RATE_LIMIT_MAX_API);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      );
    }
  }

  // Check for portal subdomain pattern: {slug}.{PORTAL_BASE_DOMAIN}
  if (
    hostname.endsWith(PORTAL_BASE_DOMAIN) &&
    hostname !== PORTAL_BASE_DOMAIN
  ) {
    const subdomain = hostname.replace(`.${PORTAL_BASE_DOMAIN}`, "");

    if (subdomain && !subdomain.includes(".")) {
      // Set header for downstream consumption (portal layout / auth middleware)
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-portal-org-subdomain", subdomain);

      const url = request.nextUrl.clone();
      const pathname = url.pathname;

      // If accessing root of subdomain, rewrite to portal entry point
      if (pathname === "/" || pathname === "") {
        url.pathname = "/en/portal";
        return NextResponse.rewrite(url, {
          request: { headers: requestHeaders },
        });
      }

      // For all other paths under the subdomain, pass through with header
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  // Auth guards for non-portal routes
  const hasSession = request.cookies.has("better-auth.session_token");

  // Extract locale prefix from pathname (e.g. "/en/contractors" -> "en", "/en/contractors" -> "/contractors")
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  const locale = localeMatch?.[1] ?? "en";
  const pathWithoutLocale = localeMatch?.[2] ?? "/";

  if (!hasSession && isDashboardRoute(pathname)) {
    // Unauthenticated user trying to access dashboard -> redirect to login
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Store path without locale so next-intl router.push() doesn't double-prefix
    url.searchParams.set("redirectTo", pathWithoutLocale);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute(pathname)) {
    // Authenticated user trying to access login/register -> redirect to dashboard
    const url = request.nextUrl.clone();
    const redirectTo = url.searchParams.get("redirectTo");
    // redirectTo is already without locale prefix, so add locale back for the raw redirect
    url.pathname = redirectTo ? `/${locale}${redirectTo}` : `/${locale}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Default: next-intl middleware for non-portal requests
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except API routes, static files, and internal Next.js paths
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
