import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  webpack(config) {
    // ESM packages built with tsc use `./foo.js` in imports. Next may still
    // bundle workspace `src/*.ts` for local packages, so map `.js` to `.ts`.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
