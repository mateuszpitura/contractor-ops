/**
 * Shared test-only i18n bootstrap for web-vite component tests.
 *
 * Why this exists:
 *   In the production Vite bundle, `i18next-icu` resolves
 *   `import IntlMessageFormat from 'intl-messageformat'` to the class
 *   constructor and ICU interpolation works. Under Node ESM (vitest),
 *   the CJS-with-`__esModule` interop in `intl-messageformat` causes the
 *   default import to surface as the module namespace object instead of
 *   the class. `i18next-icu`'s `parse()` then throws
 *   `TypeError: IntlMessageFormat is not a constructor`, the default
 *   `parseErrorHandler` swallows it, and `t('greet', { name: 'Alice' })`
 *   returns the raw `'Hello, {name}'` source string.
 *
 *   This helper runs the SPA's normal `initI18n()` + `applyLocale('en')`
 *   path, then monkey-patches the registered `i18nFormat` plugin's
 *   `parse()` method to use the correctly-resolved named export
 *   (`IntlMessageFormat`). Tests can now assert against interpolated
 *   translations (e.g. `expect(text).toContain('Alice')`) — matching
 *   real browser behaviour.
 *
 *   Centralized so all `_render.tsx` helpers stay in sync and we patch
 *   the singleton exactly once per worker.
 */

import { IntlMessageFormat } from 'intl-messageformat';
import { applyLocale, i18next, initI18n } from '../i18n/index.js';

interface IcuPluginShape {
  formats?: unknown;
  options?: { parseLngForICU?: (lng: string) => string };
  escapeVariableValues?: (v: unknown) => unknown;
  parse?: (
    res: string,
    opts: Record<string, unknown>,
    lng: string,
    ns: string,
    key: string,
    info?: unknown,
  ) => string;
}

let setupPromise: Promise<void> | undefined;

function patchIcuParse(): void {
  const services = i18next.services as unknown as { i18nFormat?: IcuPluginShape };
  const plugin = services.i18nFormat;
  if (!plugin) return;

  plugin.parse = (res, opts, lng) => {
    if (typeof res !== 'string') return res;
    try {
      const transformedLng = plugin.options?.parseLngForICU?.(lng) ?? lng;
      const formatter = new IntlMessageFormat(res, transformedLng, plugin.formats as undefined, {
        ignoreTag: true,
      });
      const values =
        plugin.escapeVariableValues && opts
          ? (plugin.escapeVariableValues(opts) as Record<string, unknown>)
          : opts;
      return String(formatter.format(values));
    } catch {
      return res;
    }
  };
}

/**
 * Idempotent — safe to call from every `_render.tsx#ensureI18n()`. The
 * underlying `initI18n()` already short-circuits if bootstrapped, and we
 * cache the locale-load + ICU-patch promise so concurrent renders share it.
 */
export function setupTestI18n(): Promise<void> {
  if (setupPromise !== undefined) return setupPromise;
  initI18n();
  setupPromise = applyLocale('en').then(() => {
    patchIcuParse();
  });
  return setupPromise;
}
