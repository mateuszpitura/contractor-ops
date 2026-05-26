/**
 * Vitest setup file — wires `@testing-library/jest-dom` matchers into the
 * test environment so `expect(el).toBeInTheDocument()` and the rest of the
 * jest-dom assertions are available without per-file imports.
 */

import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia. Several shadcn primitives (Sidebar,
// hooks that depend on responsive breakpoints) read it at mount time and
// throw without a stub. Provide the minimal API surface — listeners are
// no-ops, matches always false (assume desktop-width).
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

// jsdom does not implement ResizeObserver; @base-ui primitives that
// observe popup positioning crash on mount without it.
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

// jsdom does not implement scrollIntoView; cmdk + popover focus management
// calls it during keyboard navigation.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {
    return;
  };
}
