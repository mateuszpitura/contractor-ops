/**
 * Vite entry. Boots Sentry, asserts env, mounts the router.
 *
 * Providers (TanStack Query, tRPC, i18next, Better Auth client, theme)
 * wrap RouterProvider in subsequent steps:
 *   - Step 8 wraps with <I18nextProvider>
 *   - Step 9 wraps with <QueryClientProvider> + <TRPCProvider> + <AuthProvider>
 */

import './styles/globals.css';

import { UITranslationsProvider } from '@contractor-ops/ui/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { getClientEnv } from './env.js';
import { initI18n } from './i18n/index.js';
import { useTranslations } from './i18n/useTranslations.js';
import { initPostHog } from './lib/posthog.js';
import { PostHogIdentitySync } from './lib/posthog-identity-sync.js';
import { prefetchShellsOnIdle } from './lib/prefetch-shells.js';
import { AuthProvider } from './providers/auth-provider.js';
import { ThemeProvider } from './providers/theme-provider.js';
import { TRPCProvider } from './providers/trpc-provider.js';
import { router } from './router.js';
import { initBrowserSentry, Sentry } from './sentry.js';
import { startWebVitals } from './web-vitals.js';

/**
 * Bridge `@contractor-ops/ui`'s shadcn primitives onto the SPA's i18next
 * bundle. The primitives receive a `(key) => string` translator scoped to
 * the `Common` namespace — keys like `aria.breadcrumb` resolve against
 * `apps/web-vite/messages/{locale}.json`.
 */
function UITranslationsBridge({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Common');
  return <UITranslationsProvider t={t}>{children}</UITranslationsProvider>;
}

/**
 * Last-resort full-page fallback for errors thrown in or above the provider
 * tree (theme, i18n, auth, tRPC). Uses no design-system, i18n, or theme
 * dependency on purpose — any of those providers may be the thing that failed.
 * `Sentry.ErrorBoundary` reports the error; this only offers a reload.
 */
const reloadPage = () => {
  window.location.reload();
};

function RootErrorFallback() {
  return (
    <main
      // biome-ignore lint/nursery/noInlineStyles: last-resort error fallback deliberately avoids Tailwind/design-system — the stylesheet or a provider may be the failed dependency, so styles are inlined
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}>
      {/* biome-ignore lint/nursery/noInlineStyles: see <main> above — error fallback avoids the design system on purpose */}
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
      {/* biome-ignore lint/nursery/noInlineStyles: see <main> above — error fallback avoids the design system on purpose */}
      <p style={{ marginBottom: '1.5rem', color: '#555' }}>
        The application failed to load. Please reload the page.
      </p>
      <button
        onClick={reloadPage}
        // biome-ignore lint/nursery/noInlineStyles: see <main> above — error fallback avoids the design system on purpose
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #d4d4d8',
          background: '#fafafa',
          cursor: 'pointer',
        }}
        type="button">
        Reload
      </button>
    </main>
  );
}

// Touching getClientEnv() at module load makes any missing VITE_* var
// fail the boot before React even renders — debuggable in the console
// rather than as a "white screen on prod" mystery.
const env = getClientEnv();
initBrowserSentry(env);
initPostHog();
// i18n bootstrap must run before the router's locale loader fires; it
// registers the ICU formatter and seeds `i18next.language` from the URL.
initI18n();
// Beacon Core Web Vitals to /web-vitals on the API → PostHog.
startWebVitals(env);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing <div id="root"> in index.html.');
}

createRoot(rootEl).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<RootErrorFallback />}>
      <ThemeProvider>
        <UITranslationsBridge>
          <AuthProvider>
            <PostHogIdentitySync />
            <TRPCProvider>
              <RouterProvider router={router} />
              <Toaster richColors closeButton position="top-right" />
            </TRPCProvider>
          </AuthProvider>
        </UITranslationsBridge>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

// Warm the staff + portal shell chunks once the main thread goes idle so the
// cold-boot blank frame (lazy shell chunk download) is gone before the auth
// loader resolves and the shell mounts.
prefetchShellsOnIdle();
