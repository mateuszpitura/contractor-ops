/**
 * React Router loader helper — assert an authenticated session, otherwise
 * redirect to the locale-aware login.
 *
 * Used by every dashboard / admin / portal route's `loader`:
 *
 *     {
 *       path: 'contractors',
 *       loader: ({ params }) => requireAuth(params.locale),
 *       element: <ContractorList />,
 *     }
 *
 * Reads the Better Auth session via the framework-agnostic client (the
 * same singleton the `<AuthProvider>` exposes). When the session is
 * absent or stale, throws a `redirect` Response React Router catches and
 * navigates to.
 */

import { redirect } from 'react-router-dom';
import type { Locale } from '../i18n/messages.js';
import { DEFAULT_LOCALE, isSupportedLocale } from '../i18n/messages.js';
import { getAuthClient } from '../providers/auth-provider.js';

export interface RequireAuthOptions {
  /** Path to redirect to on missing session — defaults to `/login`. */
  redirectTo?: string;
}

export async function requireAuth(
  localeParam: string | undefined,
  opts: RequireAuthOptions = {},
): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const auth = getAuthClient();
  const session = await auth.getSession();
  if (!session.data?.user) {
    const target = opts.redirectTo ?? '/login';
    throw redirect(`/${locale}${target}`);
  }
  return null;
}
