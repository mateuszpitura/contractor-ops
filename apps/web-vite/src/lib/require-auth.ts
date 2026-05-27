/**
 * React Router loader helper — assert an authenticated session, otherwise
 * redirect to the locale-aware login, preserving the original destination
 * as `?redirectTo=…` so the LoginForm hook can navigate back after a
 * successful sign-in.
 *
 * Used by every dashboard / admin / portal route's `loader`:
 *
 *     {
 *       path: 'contractors',
 *       loader: ({ params, request }) => requireAuth(params.locale, request),
 *       element: <ContractorList />,
 *     }
 *
 * Reads the Better Auth session via the framework-agnostic client (the
 * same singleton the `<AuthProvider>` exposes). When the session is
 * absent or stale, throws a `redirect` Response React Router catches and
 * navigates to. `useLoginForm` sanitizes the `redirectTo` value before
 * navigating, so percent-encoded query strings round-trip cleanly.
 */

import { redirect } from 'react-router-dom';
import type { Locale } from '../i18n/messages.js';
import { DEFAULT_LOCALE, isSupportedLocale } from '../i18n/messages.js';
import { getAuthClient } from '../providers/auth-provider.js';

function stripLocale(pathname: string, locale: Locale): string {
  return pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/';
}

export async function requireAuth(
  localeParam: string | undefined,
  request?: Request,
): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const auth = getAuthClient();
  const session = await auth.getSession();
  if (!session.data?.user) {
    let target = `/${locale}/login`;
    if (request) {
      const url = new URL(request.url);
      const pathWithoutLocale = stripLocale(url.pathname, locale);
      // Skip the `?redirectTo=` when the user is already on the dashboard
      // root — round-tripping `/` through login adds no value and would
      // just clutter the URL bar.
      if (pathWithoutLocale !== '/') {
        const dest = `${pathWithoutLocale}${url.search}`;
        target += `?redirectTo=${encodeURIComponent(dest)}`;
      }
    }
    throw redirect(target);
  }
  return null;
}
