import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Phase C.6.a (production-hardening): wrap the build with @next/bundle-analyzer
// when ANALYZE=true. Output is written to .next/analyze/* and surfaced via
// docs/PERF-BUDGETS.md. CI gate (`size-limit`) consumes the actual chunk
// artifacts produced by the regular build, not this analyzer.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Produce a self-contained build in .next/standalone — used by the Docker
  // worker image. Vercel ignores this flag so it's safe to keep always-on.
  output: 'standalone',
  // Disable Next.js built-in request logging — all observability goes through
  // pino (observability middleware) for consistent structured logging.
  logging: {
    incomingRequests: false,
  },
  // Phase C.6.c (production-hardening): explicit images.remotePatterns
  // allowlist. Previously no remotePatterns block existed, which leaves
  // next/image refusing remote sources entirely (so this is the canonical
  // surface). The allowlist enumerates every external host the app's
  // <Image src> consumes — narrowing the Next.js image optimizer's SSRF
  // surface to known-good destinations. Anything not listed will be
  // rejected by next/image with a build-time/dev-time error.
  //
  // Hosts:
  //   - *.r2.cloudflarestorage.com — raw S3-compatible Cloudflare R2 URLs
  //     (logos, shipping labels, branding assets uploaded via the settings
  //     flow). Mirrored by the CSP img-src directive in headers() below.
  //   - lh3.googleusercontent.com — Google OAuth profile avatars (Better
  //     Auth socialProviders.google in packages/auth/src/config.ts).
  //   - *.googleusercontent.com — broader catch-all for Google avatar
  //     variants (lh4/lh5/lh6) returned by different Google OAuth scopes.
  //   - graph.microsoft.com — Microsoft Graph /me/photo endpoint for
  //     Microsoft OAuth avatars (packages/auth/src/config.ts microsoft
  //     provider). Photos served via authenticated proxy when needed.
  //
  // If R2_PUBLIC_URL is configured as a custom CDN domain (e.g.
  // cdn.contractor-ops.com), add it explicitly here in the deployment-
  // specific config layer.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'graph.microsoft.com' },
    ],
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
    // Phase C.1.b (production-hardening): the enforce CSP is static and
    // unchanged here. The companion `Content-Security-Policy-Report-Only`
    // header MOVED to apps/web/src/middleware.ts so it can interpolate a
    // fresh per-request nonce into `script-src` (preparing C.1.c — see
    // goals/production-hardening/ §10.5). Violations still stream to
    // `/api/csp-report` for the 48h observation window before C.1.c flips
    // the enforce policy onto the nonce-based directives.
    const enforceCsp = [
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
    ].join('; ');

    // Reporting API v1 endpoint group declaration. Modern browsers honour
    // `Report-To` -> POSTs `application/reports+json` payloads to the URL.
    // Legacy browsers fall back to `report-uri` -> `application/csp-report`.
    // Kept static because endpoint config does not vary per request.
    const reportToHeader = JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/api/csp-report' }],
      include_subdomains: true,
    });

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: enforceCsp,
          },
          {
            key: 'Report-To',
            value: reportToHeader,
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
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), fullscreen=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
          // Cross-Origin-Embedder-Policy: 'credentialless' is the COEP mode
          // compatible with cross-origin iframes that don't ship CORP headers
          // (e.g. DocuSign signing iframe). If COEP-violation reports appear
          // post-deploy from the DocuSign embed, fall back to relaxing or
          // removing this header.
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), {
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
