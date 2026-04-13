import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'classification',
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    sequence: {
      groupOrder: 10,
    },
  },
});
