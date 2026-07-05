import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'employee-templates',
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: 12 },
  },
});
