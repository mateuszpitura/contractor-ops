/**
 * Synchronous theme bootstrap — runs before React mounts.
 *
 * Keep in lockstep with `src/providers/theme-provider.tsx`. The
 * provider re-runs the same resolution on mount, so any drift here
 * shows up as a flash on the first paint (FOUC).
 *
 * Served from `/theme-init.js` via Vite's `public/` directory so it
 * passes the `script-src 'self'` CSP shipped by render.yaml / the
 * <meta> fallback in `index.html`.
 */
(() => {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved =
      stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    }
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {
    // localStorage unavailable (private mode / disabled cookies) — skip;
    // ThemeProvider rehydrates on mount.
  }
})();
