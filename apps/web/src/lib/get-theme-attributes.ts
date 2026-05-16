import { cookies } from 'next/headers';

/**
 * Resolved theme + density attributes for the root `<html>` element, derived
 * from cookies at request time (Server Component only).
 *
 * Why cookies and not localStorage?
 * - Server Components cannot read localStorage. To avoid a pre-hydration
 *   inline `<script>` (which forces `script-src 'unsafe-inline'` in CSP), we
 *   read durable preferences from cookies and emit the resolved class names
 *   directly in the server-rendered HTML.
 *
 * Theme strategy (Phase C.1.a — production-hardening):
 * - Default is `system`. When no `theme` cookie exists or it is `system`, we
 *   render NO `dark` class and let CSS `@media (prefers-color-scheme: dark)`
 *   (via Tailwind's `dark:` variants with `class` strategy fallback) handle
 *   the first paint. `next-themes` then hydrates and may swap classes based
 *   on the user's persisted localStorage preference.
 * - Explicit `dark` cookie -> emit `dark` class server-side, no FOUC.
 * - Explicit `light` cookie -> emit no class, no FOUC.
 *
 * Trade-off: users who toggled theme via the in-app menu prior to this change
 * have their preference in localStorage only (next-themes default). For them,
 * there may be a one-frame FOUC on first load after this change until the
 * theme toggle UI starts mirroring to cookies (deferred follow-up). This is
 * the accepted trade-off documented in `goals/production-hardening/plan.md`
 * step C.1.a.
 *
 * Density strategy:
 * - Defaults to `comfortable` (no class). `compact` cookie emits the
 *   `density-compact` class. Same FOUC caveat as theme until `useDensity`
 *   starts mirroring to cookies.
 */
export async function getThemeAttributes(): Promise<{
  themeClass: string;
  densityClass: string;
}> {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value;
  const density = cookieStore.get('density')?.value;

  // Tolerate both raw ("dark") and JSON-quoted ('"dark"') values so existing
  // localStorage-mirrored entries stay backward-compatible if the toggle UI
  // starts writing cookies in a follow-up commit.
  const normalizedTheme = theme?.replace(/^"|"$/g, '');
  const normalizedDensity = density?.replace(/^"|"$/g, '');

  return {
    themeClass: normalizedTheme === 'dark' ? 'dark' : '',
    densityClass: normalizedDensity === 'compact' ? 'density-compact' : '',
  };
}
