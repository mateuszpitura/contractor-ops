/**
 * Vitest setup file for apps/web-vite.
 *
 * - Loads `@testing-library/jest-dom` matchers so `expect(el).toBeInTheDocument()`
 *   and the rest of the jest-dom assertions are available test-wide.
 * - Stubs browser APIs that jsdom does not implement and that shadcn /
 *   base-ui primitives reach for during mount:
 *     - `window.matchMedia` — read by `useIsMobile`, sidebar responsive
 *       branches, motion-reduce checks.
 *     - `ResizeObserver` — observed by `@base-ui` popup primitives for
 *       positioning.
 *     - `Element.prototype.scrollIntoView` — called by cmdk + popover
 *       focus management during keyboard navigation.
 */

import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

import { createTRPCProxy, setTRPCMock } from '../test-utils/render-hook.js';

const globalTrpcProxy = createTRPCProxy();

vi.mock('../providers/trpc-provider.js', () => ({
  useTRPC: () => globalTrpcProxy,
  usePortalTRPC: () => globalTrpcProxy,
}));

beforeEach(() => {
  setTRPCMock({});
});

// Synchronously init i18next + load English bundle BEFORE any test imports a
// component. Tests use sync `render(<Component />)` and react-i18next reads
// the active language store on first render — without this, `useTranslation`
// hooks return null translations and components render as empty fragments
// (jsdom shows `<body><div /></body>` and queries fail with
// `TestingLibraryElementError: Unable to find an element with the text: …`).
//
// Top-level await is supported in vitest setupFiles since v0.34, so this
// block blocks suite startup until the bundle is ready.
{
  const { setupTestI18n } = await import('../test-utils/setup-test-i18n.js');
  // Initializes i18next + loads `en` bundle + patches i18next-icu's `parse()`
  // so ICU `{name}` placeholders interpolate under Node ESM. Sync await here
  // guarantees the patch is in place before any test file imports a component
  // (test-utils.tsx still calls this internally for locale switches).
  await setupTestI18n();
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class StubResizeObserver {
    observe(): void {
      // noop
    }
    unobserve(): void {
      // noop
    }
    disconnect(): void {
      // noop
    }
  }
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {
    return;
  };
}

// `Element.getAnimations()` is read by `@base-ui` ScrollArea viewport to coordinate
// open/close transitions; jsdom does not implement the Web Animations API.
if (
  typeof Element !== 'undefined' &&
  typeof (Element.prototype as Element & { getAnimations?: () => unknown[] }).getAnimations !==
    'function'
) {
  (Element.prototype as Element & { getAnimations: () => unknown[] }).getAnimations = () => [];
}
