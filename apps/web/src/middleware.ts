import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Base domain for portal subdomain routing.
 * Pattern: {slug}.{PORTAL_BASE_DOMAIN} -> resolves to org's portal.
 * Example: acme.portal.localhost:3000 or acme.portal.contractorops.com
 */
const PORTAL_BASE_DOMAIN =
  process.env.PORTAL_BASE_DOMAIN ?? "portal.localhost:3000";

/**
 * Combined middleware: portal subdomain routing + next-intl i18n.
 *
 * 1. Checks if the request hostname matches {slug}.portal.{baseDomain}.
 * 2. If it matches, sets x-portal-org-subdomain header and rewrites to portal routes.
 * 3. Otherwise falls through to next-intl middleware for standard i18n routing.
 */
export default function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";

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

  // Default: next-intl middleware for non-portal requests
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except API routes, static files, and internal Next.js paths
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
