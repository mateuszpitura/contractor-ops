/**
 * CSP directive set served by @contractor-ops/api-server.
 *
 *   - No per-request nonce. The API mostly returns JSON; the rare HTML
 *     responses are error/redirect pages that never execute inline scripts.
 *     `script-src 'none'` is the default — strictly stricter than the SPA's
 *     `'self' 'nonce-...' 'strict-dynamic'`.
 *   - `connect-src` keeps Sentry + R2 so any future error/redirect page can
 *     still beacon back. The SPA's own `connect-src` (incl. api.contractor-ops.com)
 *     lives in `apps/web-vite/index.html` via Render Static-Site headers.
 *   - `img-src` keeps the four hosts allowed today (R2, Google avatars, MS
 *     Graph) — preserves the image audit surface even on error pages.
 *
 * A 48 h CSP report-only rollout precedes enforcement on the live API
 * domain (plan.md Step 2 verify gate). Toggle via `CSP_MODE` env at boot.
 */

export interface BuildCspOptions {
  /**
   * Origins that may appear in `connect-src` in addition to 'self' (Sentry,
   * PostHog, R2). Pass the SPA origin so cross-origin XHR/fetch from a
   * rendered error page can still reach analytics, but it is unusual for
   * API HTML to need this.
   */
  extraConnectSrc?: readonly string[];
}

const FIXED_IMG_HOSTS = [
  'https://*.r2.cloudflarestorage.com',
  'https://*.googleusercontent.com',
  'https://graph.microsoft.com',
] as const;

const FIXED_CONNECT_SRC = [
  'https://*.sentry.io',
  'https://*.ingest.sentry.io',
  'https://eu.i.posthog.com',
  'https://eu-assets.i.posthog.com',
  'https://*.r2.cloudflarestorage.com',
] as const;

/**
 * Compose the API-side CSP. Intentionally strict: `script-src 'none'` means
 * the API will never execute any inline or remote script, even if an
 * upstream bug embeds one in a returned HTML body.
 */
export function buildApiCsp({ extraConnectSrc = [] }: BuildCspOptions = {}): string {
  const connect = ["'self'", ...FIXED_CONNECT_SRC, ...extraConnectSrc].join(' ');
  return [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'self'",
    `img-src 'self' data: blob: ${FIXED_IMG_HOSTS.join(' ')}`,
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

export const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: '/csp-report' }],
  include_subdomains: true,
});
