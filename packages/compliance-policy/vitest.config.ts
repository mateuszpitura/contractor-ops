import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'compliance-policy',
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: 13 },
  },
});
