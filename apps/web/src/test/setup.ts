import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { vi } from 'vitest';

/**
 * Phase 56 · Plan 07 — `IntersectionObserver` polyfill for jsdom.
 * Components that use scrollspy (`privacy-notice-toc.tsx`) rely on it; the
 * polyfill is a no-op observer so `useEffect` doesn't throw at mount time.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe(): void {
      /* no-op stub */
    }
    unobserve(): void {
      /* no-op stub */
    }
    disconnect(): void {
      /* no-op stub */
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds: readonly number[] = [];
  }
  // biome-ignore lint/suspicious/noExplicitAny: assign to globalThis
  (globalThis as any).IntersectionObserver = IntersectionObserverStub;
}

/**
 * Base UI ScrollArea schedules layout/state updates after mount (ResizeObserver, etc.),
 * which triggers "not wrapped in act(...)" in most UI tests. For tests that are not about
 * scroll behavior, a lightweight DOM stub keeps the same slots/class contract without
 * async updates. Real ScrollArea is tested in scroll-area.test.tsx via vi.unmock.
 */
/**
 * Phase 56 · Plan 07 — lightweight tRPC stub for components that wire the
 * real tanstack-react-query proxy at module import time (`@/trpc/init`).
 * Tests don't need real network calls; they assert UI state. Individual
 * tests can `vi.unmock('@/trpc/init')` when they need the real proxy.
 */
vi.mock('@/trpc/init', () => {
  const proxy: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'queryOptions' || prop === 'mutationOptions') {
          return (_input?: unknown) => ({
            mutationFn: async () => undefined,
            queryFn: async () => undefined,
            queryKey: [String(prop)],
          });
        }
        if (prop === 'queryKey') return () => ['mocked'];
        return proxy;
      },
    },
  );
  return { trpc: proxy };
});

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className, ...props }: React.ComponentProps<'div'>) =>
    React.createElement(
      'div',
      {
        'data-slot': 'scroll-area',
        className: ['relative', className].filter(Boolean).join(' '),
        ...props,
      },
      React.createElement(
        'div',
        {
          'data-slot': 'scroll-area-viewport',
          className:
            'size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
        },
        children,
      ),
    ),
  ScrollBar: () => null,
}));
