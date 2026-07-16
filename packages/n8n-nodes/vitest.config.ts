import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  test: {
    name: vitestProject.n8nNodes.name,
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    sequence: { groupOrder: vitestProject.n8nNodes.groupOrder },
  },
});
