/**
 * React Router loader helper — assert NO authenticated session on the
 * auth-only pages (`/login`, `/register`, `/verify-email`). When a session
 * already exists, bounce the user to the dashboard root (or back to the
 * `redirectTo` query param when present so a deep-link gated by
 * `requireAuth` round-trips cleanly).
 *
 * Restoration of GAP-MIDDLEWARE-004 — the legacy Next.js middleware
 * shipped this bounce in
 * `apps/web/src/middleware.ts:458-465 (isAuthRoute / hasSession)` and the
 * web-vite migration dropped it. Without the bounce, an already-signed-in
 * user landing on `/login` saw the login form (confusing) instead of
 * being routed to their dashboard.
 *
 * Used by `apps/web-vite/src/router.tsx` on every route that mirrors the
 * legacy `AUTH_ROUTES` list. Mirrors the `requireAuth.ts` API so the two
 * helpers compose: dashboard routes get `requireAuth`, auth-only pages get
 * `requireAnonymous`.
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
