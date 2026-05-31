import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'idp-saga',
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: 14 },
  },
});
