/**
 * Test-utils shim.
 *
 * Exposes `render`, `setup`, `screen`, `act`, `waitFor`, `within` with the
 * same signatures the legacy harness used.
 *
 * Providers wrapped on every render:
 *
 *   - `QueryClientProvider` (fresh QueryClient per render to keep parallel
 *     tests isolated).
 *   - `<MemoryRouter initialEntries={['/{locale}']}>` + a `:locale/*` route
 *     so components calling `useRouter` / `useParams` from the SPA's
 *     `i18n/navigation` shim resolve cleanly.
 *   - `I18nextProvider` via the SPA's own `initI18n()` + applyLocale, so
 *     `useTranslations('Namespace')` resolves against
 *     `apps/web-vite/messages/*.json`.
 *   - `<UITranslationsProvider t={t}>` so shadcn primitives consumed by
 *     the rendered tree resolve their aria-labels via the shared
 *     `Common.*` namespace.
 *
 * Locale defaults to `'en'`. Override via `render(ui, { locale: 'pl' })`
 * to exercise locale-specific behaviour.
 */

import { UITranslationsProvider } from '@contractor-ops/ui/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { applyLocale, i18next, initI18n } from '../i18n/index.js';
import { useTranslations } from '../i18n/useTranslations.js';
import { setupTestI18n } from '../test-utils/setup-test-i18n.js';

type Locale = 'en' | 'pl' | 'de' | 'ar';

interface WrapperOptions {
  locale?: Locale;
}

let i18nReady: Promise<void> | undefined;
function ensureI18n(locale: Locale): Promise<void> {
  if (!i18nReady) {
    i18nReady = (async () => {
      await initI18n();
      // Patch i18next-icu so ICU `{name}` placeholders interpolate under
      // vitest/Node ESM — without this, t('Hello {name}', { name: 'A' })
      // returns the raw "Hello {name}" string. See setupTestI18n() for
      // the underlying CJS/ESM interop bug it works around.
      await setupTestI18n();
    })();
  }
  return i18nReady.then(() => applyLocale(locale));
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function UITranslationsBridge({ children }: { children: ReactNode }) {
  const t = useTranslations('Common');
  return <UITranslationsProvider t={t}>{children}</UITranslationsProvider>;
}

export function createWrapper({ locale = 'en' }: WrapperOptions = {}) {
  // Best-effort sync init — `ensureI18n` is async but most legacy tests
  // never await it explicitly; on a cold cache the first render sees the
  // default English bundle (which is what `initI18n()` warms first), so
  // assertions on English strings stay reliable. Tests that exercise
  // pl/de/ar should `await ensureI18n('pl')` before mounting.
  void ensureI18n(locale);
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/${locale}`]}>
          <Routes>
            <Route
              path="/:locale/*"
              element={
                <I18nextProvider i18n={i18next}>
                  <UITranslationsBridge>{children}</UITranslationsBridge>
                </I18nextProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
}

function customRender(ui: ReactElement, { locale = 'en', ...options }: CustomRenderOptions = {}) {
  return render(ui, {
    wrapper: createWrapper({ locale }),
    ...options,
  });
}

function setup(ui: ReactElement, options?: CustomRenderOptions) {
  const user = userEvent.setup();
  const result = customRender(ui, options);
  return { user, ...result };
}

// biome-ignore lint/performance/noBarrelFile: test render helper
export { act, screen, waitFor, within } from '@testing-library/react';
export { customRender as render, setup };
