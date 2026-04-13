import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@contractor-ops/test-utils': path.join(packagesDir, 'test-utils/src/index.ts'),
    },
  },
  test: {
    name: vitestProject.integrations.name,
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    sequence: { groupOrder: vitestProject.integrations.groupOrder },
  },
});
