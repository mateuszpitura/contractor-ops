import { defineConfig } from 'vitest/config';

/**
 * Live integration-smoke config — separate from every package's `turbo test`
 * vitest. Only picks up `tests/integration-smoke/**\/*.smoke.ts`, so the main
 * pipeline never runs these. Invoke via `pnpm test:integration:smoke`.
 *
 * Suites self-skip unless `RUN_LIVE_SMOKE=1` + provider creds are present
 * (see tests/integration-smoke/harness.ts), so a credential-less run is a
 * clean all-skipped pass rather than a failure.
 */
export default defineConfig({
  test: {
    include: ['tests/integration-smoke/**/*.smoke.ts'],
    // Real network calls — generous per-test timeout, no parallel hammering
    // of a single provider sandbox.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    passWithNoTests: true,
    reporters: ['default'],
  },
});
