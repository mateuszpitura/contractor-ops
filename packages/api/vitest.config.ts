import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  test: {
    name: vitestProject.api.name,
    /** `billing-service` imports `stripe-client` at module load; real key not used when Stripe is mocked */
    env: {
      STRIPE_SECRET_KEY: 'sk_test_0000000000000000000000000000000000000000000000000000000000000000',
    },
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    /** Avoid cross-file `vi.mock("@contractor-ops/db")` leakage between workers */
    pool: 'forks',
    sequence: { groupOrder: vitestProject.api.groupOrder },
  },
});
