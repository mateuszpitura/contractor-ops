import { defineConfig } from 'vitest/config';

/**
 * @contractor-ops/ui — vitest project config.
 *
 * Shadcn primitive tests use `@testing-library/react` + `jsdom`. The
 * primitives default labels via `useUITranslations()`, which falls back to
 * English when no `<UITranslationsProvider>` is mounted — so tests can
 * render the component directly without wiring an i18n runtime.
 *
 * Tests live alongside their source (`src/components/shadcn/__tests__/*`)
 * to keep the protected surface visible next to the public exports.
 */
export default defineConfig({
  test: {
    name: '@contractor-ops/ui',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    sequence: { groupOrder: 17 },
  },
});
