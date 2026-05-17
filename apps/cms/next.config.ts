import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
// Monorepo root (../../ from apps/cms): Turbopack resolves `next` from the inferred workspace
// root — with only apps/cms/next.config pointing at apps/cms, Next 16.2 can still treat
// `src/app` as the project dir and fail to find `next/package.json`. Anchoring Turbopack to
// the repo root matches lockfile/workspace detection (see next.config turbopack.root docs).
const monorepoRoot = path.resolve(dirname, '..', '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  logging: {
    incomingRequests: false,
  },
  transpilePackages: ['@contractor-ops/logger', '@contractor-ops/ui'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    };
    return config;
  },
  turbopack: {
    root: monorepoRoot,
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
