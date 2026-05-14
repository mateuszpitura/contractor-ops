import { defineConfig } from 'vitest/config';

/**
 * @contractor-ops/ui — vitest project config.
 *
 * Pure-TS unit tests only at this stage (status mapper, hooks). React
 * component tests with @testing-library/react + jsdom land in the next
 * commit when we extend the harness.
 */
export default defineConfig({
  test: {
    name: '@contractor-ops/ui',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
