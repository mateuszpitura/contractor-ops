import { resolve } from 'node:path';
import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import { defineConfig } from 'vitest/config';

import { vitestProject } from '../../vitest.monorepo';

export default defineConfig({
  // MDX plugin must run BEFORE @vitejs/plugin-react so .mdx files are compiled
  // to JSX first, then React plugin transforms the result. Keep rehype plugin
  // list in sync with `apps/web/next.config.ts` so dev/test/prod render
  // identically (same heading IDs, same autolink wrapping behaviour).
  plugins: [
    mdx({
      remarkPlugins: [],
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
      // No providerImportSource — tests render MDX components directly without
      // a global MDXProvider context. In production Next.js uses
      // `src/mdx-components.tsx` per App Router convention.
    }),
    react(),
  ],
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
