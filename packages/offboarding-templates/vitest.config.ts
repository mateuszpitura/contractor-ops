import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'offboarding-templates',
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: 12 },
  },
});
