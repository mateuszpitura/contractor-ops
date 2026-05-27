/**
 * React Router v7 data router.
 *
 * Public routes (auth, legal, portal) sit directly under `/:locale`.
 * Staff dashboard routes render inside {@link DashboardShell} (Step 10 batch 2).
 */

import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, redirect } from 'react-router-dom';
import { RouteErrorBoundary } from './components/error/route-error-boundary.js';
import { applyLocale } from './i18n/index.js';
import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/messages.js';
import { requireAuth } from './lib/require-auth.js';
import { requirePortalAuth } from './lib/require-portal-auth.js';
import { dashboardRoutes } from './router/dashboard-routes.js';
import { portalRoutes } from './router/portal-routes.js';

const DashboardShell = lazy(() =>
  import('./components/layout/dashboard-shell-container.js').then(m => ({
    default: m.DashboardShellContainer,
  })),
);
const PortalShell = lazy(() =>
  import('./components/layout/portal-shell-container.js').then(m => ({
    default: m.PortalShellContainer,
  })),
);

const LoginPage = lazy(() => import('./pages/auth/login.js'));
const RegisterPage = lazy(() => import('./pages/auth/register.js'));
const VerifyEmailPage = lazy(() => import('./pages/auth/verify-email.js'));
const InvitePage = lazy(() => import('./pages/auth/invite.js'));
const BreachNotificationPage = lazy(() => import('./pages/legal/breach-notification.js'));
const PrivacyPage = lazy(() => import('./pages/legal/privacy.js'));
const SubProcessorsPage = lazy(() => import('./pages/legal/sub-processors.js'));
const TermsPage = lazy(() => import('./pages/legal/terms.js'));
const PrivacyJurisdictionPage = lazy(() => import('./pages/legal/privacy-jurisdiction.js'));
const PortalLoginPage = lazy(() => import('./pages/portal/login.js'));
const PortalLoginVerifyPage = lazy(() => import('./pages/portal/login-verify.js'));
const PortalInvoiceSubmitSuccessPage = lazy(
  () => import('./pages/portal/invoice-submit-success.js'),
);

function page(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

/**
 * Root layout — hosts the NuqsAdapter so nuqs hooks (useQueryState,
 * useQueryStates) can subscribe to React Router's URL state. Adapter
 * must live inside RouterProvider's context, hence as a layout route
 * wrapping every child route.
 */
function RootLayout() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  );
}

// React Router v7 warns when an async loader runs without a fallback during
// initial hydration ("No `HydrateFallback` element provided"). Render the
// shared spinner so the cold-boot frame matches the shell's loading state.
function RootHydrateFallback() {
  return null;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    HydrateFallback: RootHydrateFallback,
    // Replace React Router's default ErrorBoundary so thrown loader/component
    // errors get logged with full context (vite-plugin-terminal serializes
    // raw Error instances to `{}` — see route-error-boundary.tsx).
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        path: '/',
        loader: () => redirect(`/${DEFAULT_LOCALE}`),
      },
      {
        path: '/:locale',
        loader: async ({ params }) => {
          if (!isSupportedLocale(params.locale)) return redirect(`/${DEFAULT_LOCALE}`);
          await applyLocale(params.locale);
          return null;
        },
        children: [
          // Auth (no dashboard shell) — `requireAnonymous` bounces already-signed-in
          // users back to the dashboard root (or the deep-link they came from)
          // per legacy parity. `/invite/:token` deliberately skips the bounce
          // because invite acceptance is valid for already-signed-in users too
          // (e.g. accepting a second-org invite). Restoration of GAP-MIDDLEWARE-004.
          {
            path: 'login',
            loader: async ({ params, request }) => {
              const { requireAnonymous } = await import('./lib/require-anonymous.js');
              const redirectTo = new URL(request.url).searchParams.get('redirectTo');
              return requireAnonymous(params.locale, { redirectTo });
            },
            element: page(<LoginPage />),
          },
          {
            path: 'register',
            loader: async ({ params, request }) => {
              const { requireAnonymous } = await import('./lib/require-anonymous.js');
              const redirectTo = new URL(request.url).searchParams.get('redirectTo');
              return requireAnonymous(params.locale, { redirectTo });
            },
            element: page(<RegisterPage />),
          },
          {
            path: 'verify-email',
            loader: async ({ params, request }) => {
              const { requireAnonymous } = await import('./lib/require-anonymous.js');
              const redirectTo = new URL(request.url).searchParams.get('redirectTo');
              return requireAnonymous(params.locale, { redirectTo });
            },
            element: page(<VerifyEmailPage />),
          },
          { path: 'invite/:token', element: page(<InvitePage />) },
          // Legal (public)
          { path: 'legal/breach-notification', element: page(<BreachNotificationPage />) },
          { path: 'legal/privacy', element: page(<PrivacyPage />) },
          { path: 'legal/sub-processors', element: page(<SubProcessorsPage />) },
          { path: 'legal/terms', element: page(<TermsPage />) },
          { path: 'legal/privacy/:jurisdiction', element: page(<PrivacyJurisdictionPage />) },
          // Portal — public routes (no auth shell)
          { path: 'portal/login', element: page(<PortalLoginPage />) },
          { path: 'portal/login/verify', element: page(<PortalLoginVerifyPage />) },
          {
            path: 'portal/invoices/submit/success',
            element: page(<PortalInvoiceSubmitSuccessPage />),
          },
          // Portal — authenticated shell (parity with Next `(portal)/layout.tsx`).
          // Child route table is registered synchronously so React Router can
          // resolve nested paths during initial match. The shell component +
          // every page inside it stay code-split via React.lazy + Suspense.
          {
            element: page(<PortalShell />),
            loader: ({ params, request }) => requirePortalAuth(params.locale, request),
            children: portalRoutes,
          },
          // Staff dashboard (sidebar + top bar) — same eager-children pattern.
          // Bare `/:locale` matches `dashboardRoutes`' `{ index: true }` here.
          {
            element: page(<DashboardShell />),
            loader: ({ params, request }) => requireAuth(params.locale, request),
            children: dashboardRoutes,
          },
        ],
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

function NotFound() {
  return (
    <main>
      <h1>404</h1>
      <p>Route not found.</p>
    </main>
  );
}
