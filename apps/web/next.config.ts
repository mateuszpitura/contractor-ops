import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
    // Phase C.1.b (production-hardening): the existing enforce CSP is
    // unchanged. A second `Content-Security-Policy-Report-Only` header ships
    // the future-state nonce-friendly directives (drops `'unsafe-inline'`
    // from script-src, narrows img-src). Violations stream to
    // `/api/csp-report` for the 48h observation window before C.1.c flips
    // the enforce policy.
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

    // Future-state directives mirrored in report-only mode. Differences vs
    // enforce:
    //   - script-src drops 'unsafe-inline' (relies on prior C.1.a removal of
    //     dangerouslySetInnerHTML; next-themes injects a small inline script
    //     that may still report — tracked for C.1.c follow-up).
    //   - style-src keeps 'unsafe-inline' because Next.js + Tailwind ship
    //     inline <style> tags; dropping it requires a hashed/nonce-based
    //     style pipeline that is out of scope here.
    //   - img-src narrows `https:` -> Cloudflare R2 + Google avatar host.
    //   - connect-src adds the explicit Sentry tunnel route via /monitoring
    //     handled by withSentryConfig; the wildcard is already covered.
    //   - report-to + report-uri pipe violations to /api/csp-report.
    const reportOnlyCsp = [
      "default-src 'self'",
      `script-src 'self'${isDev ? " 'unsafe-eval'" : ''} https://unpkg.com https://*.sentry-cdn.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.googleusercontent.com",
      "connect-src 'self' https://*.docusign.com https://unpkg.com https://*.sentry.io https://*.ingest.sentry.io",
      "frame-src 'self' https://*.docusign.com https://*.docusign.net https://apps-d.docusign.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'report-uri /api/csp-report',
      'report-to csp-endpoint',
    ].join('; ');

    // Reporting API v1 endpoint group declaration. Modern browsers honour
    // `Report-To` -> POSTs `application/reports+json` payloads to the URL.
    // Legacy browsers fall back to `report-uri` -> `application/csp-report`.
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
            key: 'Content-Security-Policy-Report-Only',
            value: reportOnlyCsp,
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
