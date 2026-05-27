/**
 * React Router loader helper — assert NO authenticated session on the
 * auth-only pages (`/login`, `/register`, `/verify-email`). When a session
 * already exists, bounce the user to the dashboard root (or to the
 * `redirectTo` query value when present, so a deep-link gated by
 * `requireAuth` round-trips cleanly).
 *
 * Mirrors the `requireAuth` API so the two helpers compose: dashboard
 * routes get `requireAuth`, auth-only pages get `requireAnonymous`.
 */

import { redirect } from 'react-router-dom';
import type { Locale } from '../i18n/messages.js';
import { DEFAULT_LOCALE, isSupportedLocale } from '../i18n/messages.js';
import { getAuthClient } from '../providers/auth-provider.js';

export interface RequireAnonymousOptions {
  /**
   * Optional `redirectTo` query-string value from the current URL. When
   * present, the bounce target becomes `/{locale}{redirectTo}` so a
   * deep-link that originally routed the user through `/login?redirectTo=…`
   * still lands them where they wanted to go.
   */
  redirectTo?: string | null;
}

export async function requireAnonymous(
  localeParam: string | undefined,
  opts: RequireAnonymousOptions = {},
): Promise<null> {
  const locale: Locale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const auth = getAuthClient();
  const session = await auth.getSession();
  if (session.data?.user) {
    const target = opts.redirectTo ? `/${locale}${opts.redirectTo}` : `/${locale}`;
    throw redirect(target);
  }
  return null;
}
