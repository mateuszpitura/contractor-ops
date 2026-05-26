import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the legacy `apps/web` tsconfig `@/*` → `src/*` alias so
      // ported tests + components keep their original import paths.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: vitestProject.webVite.name,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    sequence: { groupOrder: vitestProject.webVite.groupOrder },
  },
});
