'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

/**
 * Cookie attributes shared by the theme/density cookie writers.
 *
 * - `path=/`         — visible to every Server Component request.
 * - `max-age=1y`     — long enough to survive between sessions; matches the
 *                       next-themes localStorage retention model.
 * - `samesite=lax`   — safe default; the cookie is read-only for the server
 *                       and never sent on cross-site POSTs.
 * - NO `secure`      — must work over plain http in local dev. The cookie
 *                       carries no auth value, only a presentation hint.
 */
const COOKIE_ATTRS = 'path=/; max-age=31536000; samesite=lax';

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${COOKIE_ATTRS}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return;
  const target = `${name}=`;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith(target)) {
      try {
        return decodeURIComponent(part.slice(target.length));
      } catch {
        return part.slice(target.length);
      }
    }
  }
  return;
}

/**
 * ThemeCookieSync — mirrors the active next-themes value to a `theme` cookie
 * so the Server Component in `apps/web/src/lib/get-theme-attributes.ts` can
 * render the correct `dark` class on first paint (no FOUC).
 *
 * Why a separate client component instead of editing the layout?
 * - The layout is a Server Component and must stay one (it reads `headers()`
 *   for nonce/locale plumbing). All cookie writes happen here, under the
 *   existing <ThemeProvider> tree, so we avoid converting the layout.
 *
 * One-time migration:
 * - Users who toggled theme before this commit only have a localStorage entry
 *   (next-themes default storageKey is `theme`). On first mount, if the
 *   cookie is missing we copy the localStorage value across so they don't
 *   lose their preference on the FOUC-elimination upgrade.
 *
 * Subsequent updates:
 * - The `useTheme()` value (theme, not resolvedTheme) is the source of truth
 *   for what the user explicitly chose — including `system`, which we mirror
 *   so the server reader knows to defer to `prefers-color-scheme` rather than
 *   forcing dark/light.
 */
export function ThemeCookieSync() {
  const { theme } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Migration path: localStorage → cookie. Runs only when the cookie is
    // absent so we never overwrite an explicit later choice with a stale
    // localStorage value.
    const existingCookie = readCookie('theme');
    if (!existingCookie) {
      // safe-swallow: localStorage may throw under Safari private mode or
      // blocked storage. One-time migration is non-blocking; the cookie sync
      // below still wins on the next user-driven theme change. We capture
      // the error and discard it explicitly so the intent is grep-able.
      try {
        const stored = window.localStorage.getItem('theme');
        if (stored) {
          // next-themes stores raw strings (`light` / `dark` / `system`);
          // tolerate JSON-quoted values defensively to match the server
          // reader's normalization in get-theme-attributes.ts.
          const normalized = stored.replace(/^"|"$/g, '');
          writeCookie('theme', normalized);
        }
      } catch (err) {
        void err;
      }
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    writeCookie('theme', theme);
  }, [theme]);

  return null;
}
