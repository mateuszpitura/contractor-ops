import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  test: {
    name: vitestProject.apiServer.name,
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    sequence: { groupOrder: vitestProject.apiServer.groupOrder },
  },
});
