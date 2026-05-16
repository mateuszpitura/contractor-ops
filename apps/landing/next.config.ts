import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Future-state nonce-friendly CSP, shipped in report-only mode alongside any
 * runtime serving layer (Cloudflare Worker / Render Node) so the 48h
 * observation window before C.1.c can establish a clean baseline.
 *
 * Static-export note: `output: 'export'` produces a pure HTML bundle and Next
 * never runs `headers()` at request time. This block is kept in sync with
 * `apps/web/next.config.ts` so:
 *   - whoever fronts the export (Cloudflare Pages, Nginx, Render static
 *     site) can lift the values from a single source of truth, and
 *   - if the landing app later adopts a runtime server, the headers flip on
 *     automatically.
 *
 * `Content-Security-Policy-Report-Only` cannot be set via a `<meta http-equiv>`
 * tag (browsers reject it per spec) — there is no in-HTML fallback for the
 * static-export case. The accompanying enforce policy can be mirrored into
 * `<meta http-equiv="Content-Security-Policy">` if needed; deferred until
 * the runtime-vs-CDN strategy is settled in Phase D.
 */
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ''} https://*.sentry-cdn.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://*.posthog.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'report-uri /api/csp-report',
  'report-to csp-endpoint',
].join('; ');

const reportToHeader = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: '/api/csp-report' }],
  include_subdomains: true,
});

const nextConfig: NextConfig = {
  output: 'export',
  /**
   * Static-export caveat (repeated here for the security headers block):
   * `output: 'export'` means Next.js never invokes `headers()` at runtime.
   * The values below are the single source of truth for whatever CDN /
   * Nginx / Cloudflare Pages fronts the exported HTML bundle. Mirror these
   * onto the edge configuration when wiring landing's hosting layer.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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

export default nextConfig;
