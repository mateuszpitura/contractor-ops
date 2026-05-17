import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  // The legal-content pipeline was migrated from MDX to plain TSX; the
  // MDX rollup plugin and its rehype companions were removed alongside
  // the @mdx-js/* dependencies. Only @vitejs/plugin-react is needed now —
  // keep this slot ready if a future feature reintroduces a Vite-side
  // transformer.
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    name: vitestProject.web.name,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    css: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    maxWorkers: 4,
    sequence: { groupOrder: vitestProject.web.groupOrder },
  },
});
