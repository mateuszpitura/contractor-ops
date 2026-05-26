'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

/**
 * UI-package translator surface.
 *
 * Why this exists:
 *   `packages/ui` is consumed by three apps with two different i18n
 *   runtimes — `apps/web` + `apps/landing` use `next-intl`; `apps/web-vite`
 *   uses `i18next`. The shadcn primitives need localized aria-labels and
 *   visible strings, so the package can not hard-import either runtime.
 *
 * Solution:
 *   Each host wraps its tree once with `<UITranslationsProvider t={fn}>`
 *   where `fn` is a function the host already has from its own i18n
 *   runtime — `useTranslations('Common')` from next-intl OR the i18next
 *   shim with the same signature. Primitives consume `useUITranslations()`
 *   for default labels.
 *
 *   When no provider is mounted (e.g. a test that mounts a primitive in
 *   isolation, or a host that has not wired the provider yet) the hook
 *   falls back to English defaults so a11y stays functional and nothing
 *   crashes at render time.
 *
 * Naming note:
 *   The translator receives a flat dot-namespaced key (`aria.breadcrumb`)
 *   that matches the legacy `useTranslations('Common')` namespace. Hosts
 *   that pre-scope to the `Common` namespace can pass their `t` directly
 *   with no key transformation.
 */

export type UITranslator = (key: string, params?: Record<string, unknown>) => string;

/**
 * English-default fallback for every key the primitives reference. Used when
 * no `<UITranslationsProvider>` is mounted. Kept in sync with the matching
 * keys in `apps/web/messages/en.json` + `apps/web-vite/...` so an unwrapped
 * host still ships sensible labels.
 */
const DEFAULT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'aria.breadcrumb': 'Breadcrumb',
  'aria.closeDialog': 'Close dialog',
  'aria.closePanel': 'Close panel',
  'aria.toggleSidebar': 'Toggle sidebar',
  'sidebar.title': 'Sidebar',
  'sidebar.description': 'Mobile sidebar navigation menu',
  'srOnly.more': 'More',
  'commandPalette.title': 'Command palette',
  'commandPalette.description': 'Search and execute commands',
});

const UITranslationsContext = createContext<UITranslator | null>(null);

export interface UITranslationsProviderProps {
  /**
   * Host-supplied translator. Receives the same dot-namespaced keys the
   * legacy `useTranslations('Common')` call expected (e.g. `aria.breadcrumb`).
   */
  t: UITranslator;
  children: ReactNode;
}

export function UITranslationsProvider({ t, children }: UITranslationsProviderProps) {
  return <UITranslationsContext.Provider value={t}>{children}</UITranslationsContext.Provider>;
}

/**
 * Returns the host-supplied translator, or an English-defaults fallback
 * when no provider is mounted. Always returns a callable, never throws.
 */
export function useUITranslations(): UITranslator {
  const provided = useContext(UITranslationsContext);
  if (provided) return provided;
  return (key, _params) => DEFAULT_LABELS[key] ?? key;
}
