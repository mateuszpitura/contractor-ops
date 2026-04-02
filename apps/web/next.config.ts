import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Disable Next.js built-in request logging — all observability goes through
  // pino (observability middleware) for consistent structured logging.
  logging: {
    incomingRequests: false,
  },
  transpilePackages: [
    "@contractor-ops/auth",
    "@contractor-ops/api",
    "@contractor-ops/logger",
    "@contractor-ops/validators",
    "@contractor-ops/ui",
    "react-pdf",
  ],
  serverExternalPackages: [
    "@contractor-ops/db",
    "@contractor-ops/integrations",
    "docusign-esign",
  ],
  webpack(config, { isServer }) {
    // ESM TypeScript packages use .js extensions in imports (e.g. "./foo.js")
    // that must resolve to .ts source files when transpiled by Next.js webpack.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    if (isServer) {
      // docusign-esign uses non-standard bare imports (e.g. 'api/BillingApi'
      // instead of './api/BillingApi') that webpack cannot resolve.
      // Force it to be resolved at runtime by Node.js.
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("docusign-esign");
      }
    }

    // Suppress "Serializing big strings" warnings from webpack cache.
    // These are informational and do not affect the build output.
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://*.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.docusign.com https://unpkg.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' https://*.docusign.com https://*.docusign.net https://apps-d.docusign.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
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
  tunnelRoute: "/monitoring",

  // Automatically monitor Vercel cron jobs
  automaticVercelMonitors: true,

  // Suppress source map upload logs in CI
  silent: !process.env.CI,

  // Tree-shake Sentry debug code in production
  disableLogger: true,
});
