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
import { AuthProvider } from './providers/auth-provider.js';
import { ThemeProvider } from './providers/theme-provider.js';
import { TRPCProvider } from './providers/trpc-provider.js';
import { router } from './router.js';
import { initBrowserSentry } from './sentry.js';
import { startWebVitals } from './web-vitals.js';

/**
 * Bridge `@contractor-ops/ui`'s shadcn primitives onto the SPA's i18next
 * bundle. The primitives receive a `(key) => string` translator scoped to
 * the `Common` namespace — keys like `aria.breadcrumb` resolve against the
 * same flat bundle apps/web reads via next-intl, so a label edit in
 * apps/web/messages/en.json shows up identically in both apps without
 * duplicating the dictionary.
 */
function UITranslationsBridge({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Common');
  return <UITranslationsProvider t={t}>{children}</UITranslationsProvider>;
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
    <ThemeProvider>
      <UITranslationsBridge>
        <AuthProvider>
          <TRPCProvider>
            <RouterProvider router={router} />
            <Toaster richColors closeButton position="top-right" />
          </TRPCProvider>
        </AuthProvider>
      </UITranslationsBridge>
    </ThemeProvider>
  </StrictMode>,
);
