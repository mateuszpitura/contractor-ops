import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'feature-flags',
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: 12 },
  },
});
