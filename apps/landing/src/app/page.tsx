import type { Metadata } from 'next';
import { GeoRedirect } from '@/components/geo-redirect';
import { defaultLocale } from '@/i18n';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // Meta-refresh is a no-JS fallback for crawlers that never execute
  // GeoRedirect. Same default-locale target as the client redirect.
  other: {
    refresh: `0;url=/${defaultLocale}`,
  },
};

/**
 * Root entry point. The landing app uses `output: 'export'`, so middleware
 * cannot intercept `/` to redirect by geo. Instead we hydrate a small
 * client component that detects the visitor's market (cookie → language →
 * IP) and replaces the location with `/<locale>` once detected. Crawlers
 * fall through to the meta-refresh above.
 */
export default function RootPage() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=/${defaultLocale}`} />
      <noscript>
        <p>
          Redirecting to <a href={`/${defaultLocale}`}>Contractor Ops</a>…
        </p>
      </noscript>
      <GeoRedirect fallbackLocale={defaultLocale} />
    </>
  );
}
