/**
 * React Router loader helper — assert a valid portal session, otherwise
 * redirect to the locale-aware portal login.
 *
 * Used by the protected portal route group's `loader`:
 *
 *     {
 *       element: <PortalShell />,
 *       loader: ({ params, request }) => requirePortalAuth(params.locale, request),
 *       children: [ ... ],
 *     }
 *
 * Fast-path: absent `portal_session` cookie → redirect without an API
 * round-trip. When a cookie exists, validates via `portal.getSession`.
 * Deep-links are preserved through `?redirectTo=…` so contractors
 * resume at their target page after sign-in.
 */

import type { PortalAppRouter } from '@contractor-ops/api';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { redirect } from 'react-router-dom';
import superjson from 'superjson';

import { getClientEnv } from '../env.js';
import type { Locale } from '../i18n/messages.js';
import { DEFAULT_LOCALE, isSupportedLocale } from '../i18n/messages.js';

let portalClient: ReturnType<typeof createTRPCClient<PortalAppRouter>> | undefined;

function getPortalTrpcClient() {
  if (!portalClient) {
    const env = getClientEnv();
    portalClient = createTRPCClient<PortalAppRouter>({
      links: [
        httpBatchLink({
          url: `${env.VITE_API_URL}/api/trpc/portal`,
          fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
          transformer: superjson,
        }),
      ],
    });
  }
  return portalClient;
}

/**
 * Cheap cookie-shape guard. The `portal_session` cookie carries a signed,
 * URL-safe base64 token; an empty or obviously-malformed value can
 * satisfy a naive `startsWith` check but is clearly not a real session.
 * Reject those at the edge to skip the tRPC `portal.getSession` round-trip
 * and bounce straight to portal login. The authoritative validation
 * still runs in the tRPC `portalSessionFromCookie` resolver — this guard
 * is never the sole gate.
 */
export function hasPortalSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const entry = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('portal_session='));
  if (!entry) return false;
  const value = entry.slice('portal_session='.length);
  if (value.length < 20) return false;
  return /^[A-Za-z0-9._\-~+/=]+$/.test(value);
}

function isPortalSessionInvalid(err: unknown): boolean {
  if (err instanceof TRPCClientError) {
    return err.data?.code === 'UNAUTHORIZED';
  }
  return false;
}

function isTransientPortalAuthError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof TRPCClientError) {
    const httpStatus = err.data?.httpStatus;
    if (httpStatus !== undefined && httpStatus >= 500) {
      return true;
    }
    const code = err.data?.code;
    return (
      code === 'INTERNAL_SERVER_ERROR' ||
      code === 'TIMEOUT' ||
      code === 'BAD_GATEWAY' ||
      code === 'SERVICE_UNAVAILABLE'
    );
  }
  return false;
}

/**
 * Build `/{locale}/portal/login[?redirectTo=…]` so a contractor landing on
 * a deep-link (e.g. `/{locale}/portal/invoices/123`) without a session
 * resumes at that path after a successful portal sign-in. Mirror of the
 * staff-side helper in `require-auth.ts`.
 */
function portalLoginTarget(locale: Locale, request?: Request): string {
  if (!request) return `/${locale}/portal/login`;
  const url = new URL(request.url);
  const pathWithoutLocale = url.pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/';
  if (pathWithoutLocale === '/' || pathWithoutLocale === '/portal/login') {
    return `/${locale}/portal/login`;
  }
  const dest = `${pathWithoutLocale}${url.search}`;
  return `/${locale}/portal/login?redirectTo=${encodeURIComponent(dest)}`;
}

export async function requirePortalAuth(
  localeParam: string | undefined,
  request?: Request,
): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  if (!hasPortalSessionCookie()) {
    throw redirect(portalLoginTarget(locale, request));
  }

  try {
    await getPortalTrpcClient().portal.getSession.query();
    return null;
  } catch (err) {
    if (isTransientPortalAuthError(err)) {
      throw err;
    }
    if (isPortalSessionInvalid(err)) {
      throw redirect(portalLoginTarget(locale, request));
    }
    throw err;
  }
}
