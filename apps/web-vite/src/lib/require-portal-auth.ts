/**
 * React Router loader helper — assert a valid portal session, otherwise
 * redirect to the locale-aware portal login.
 *
 * Used by the protected portal route group's `loader`:
 *
 *     {
 *       element: <PortalShell />,
 *       loader: ({ params }) => requirePortalAuth(params.locale),
 *       children: [ ... ],
 *     }
 *
 * Fast-path: absent `portal_session` cookie → redirect without an API round
 * trip. When a cookie exists, validates via `portal.getSession` (same
 * contract as Next.js `(portal)/layout.tsx`).
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

function hasPortalSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(part => part.trim().startsWith('portal_session='));
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

export async function requirePortalAuth(localeParam: string | undefined): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  if (!hasPortalSessionCookie()) {
    throw redirect(`/${locale}/portal/login`);
  }

  try {
    await getPortalTrpcClient().portal.getSession.query();
    return null;
  } catch (err) {
    if (isTransientPortalAuthError(err)) {
      throw err;
    }
    if (isPortalSessionInvalid(err)) {
      throw redirect(`/${locale}/portal/login`);
    }
    throw err;
  }
}
