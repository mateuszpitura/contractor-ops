import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Produce a self-contained build in .next/standalone — used by the Docker
  // worker image. Vercel ignores this flag so it's safe to keep always-on.
  output: 'standalone',
  // Allow .mdx files to be treated as page/route modules. Keep .ts/.tsx first so
  // existing routes take precedence when a jurisdiction has both (defensive).
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // Turbopack-native MDX support (replaces @next/mdx webpack loader).
  experimental: {
    mdxRs: true,
  },
  // Disable Next.js built-in request logging — all observability goes through
  // pino (observability middleware) for consistent structured logging.
  logging: {
    incomingRequests: false,
  },
  transpilePackages: [
    '@contractor-ops/auth',
    '@contractor-ops/api',
    '@contractor-ops/logger',
    '@contractor-ops/validators',
    '@contractor-ops/ui',
    'react-pdf',
  ],
  // Server-only packages excluded from webpack bundling. These either ship
  // native bindings (`libxmljs2`, `clamscan` via `bindings`), use runtime path
  // lookups (`saxon-js`), or use non-standard bare imports (`docusign-esign`).
  // Bundling them breaks at runtime because `__dirname` resolves to the
  // .next chunks dir instead of the package's own folder. `@contractor-ops/einvoice`
  // re-exports libxmljs2/saxon-js, so it must travel with them.
  serverExternalPackages: [
    '@contractor-ops/db',
    '@contractor-ops/einvoice',
    '@contractor-ops/integrations',
    'docusign-esign',
    'libxmljs2',
    'saxon-js',
    'clamscan',
  ],
  webpack(config, { isServer }) {
    // ESM TypeScript packages use .js extensions in imports (e.g. "./foo.js")
    // that must resolve to .ts source files when transpiled by Next.js webpack.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    if (isServer) {
      // Same packages also marked as webpack externals for the server bundle.
      // `serverExternalPackages` covers the App Router build pipeline; the
      // explicit externals list here covers webpack-specific code paths
      // (Sentry instrumentation, manual chunk splits) that don't honour it.
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(
          'docusign-esign',
          'libxmljs2',
          'saxon-js',
          'clamscan',
          '@contractor-ops/einvoice',
        );
      }
    }

    // Suppress "Serializing big strings" warnings from webpack cache.
    // These are informational and do not affect the build output.
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    };

    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://unpkg.com https://*.sentry-cdn.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.docusign.com https://unpkg.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' https://*.docusign.com https://*.docusign.net https://apps-d.docusign.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Sentry org/project — set via env or replace with your values
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload auth token
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Route Sentry events through the app to bypass ad blockers
  tunnelRoute: '/monitoring',

  // Automatically monitor Vercel cron jobs
  automaticVercelMonitors: true,

  // Suppress source map upload logs in CI
  silent: !process.env.CI,

  // Tree-shake Sentry debug code in production
  disableLogger: true,
});
