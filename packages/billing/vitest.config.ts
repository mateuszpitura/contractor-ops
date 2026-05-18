import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  test: {
    name: vitestProject.billing.name,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    sequence: { groupOrder: vitestProject.billing.groupOrder },
  },
});
