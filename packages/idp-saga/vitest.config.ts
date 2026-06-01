import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  test: {
    name: vitestProject.idpSaga.name,
    include: ['src/**/*.test.ts'],
    sequence: { groupOrder: vitestProject.idpSaga.groupOrder },
  },
});
