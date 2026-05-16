import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Noto_Sans_Arabic, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';
import { PostHogProvider } from '@/lib/posthog';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
});

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Contractor Ops — B2B Contractor Management',
  description:
    'Contracts, onboarding, invoices, approvals, payments and offboarding — all in one place.',
};

/**
 * Root layout for the landing app.
 *
 * Phase C.1.a (production-hardening): the previous inline
 * `<script dangerouslySetInnerHTML>` bootstrap (lang/dir detection + dark-mode
 * preference) has been removed to unblock a nonce-based CSP roll-out. Replacements:
 *
 * - Dark mode: handled purely by CSS `@media (prefers-color-scheme: dark)`.
 *   The landing app has no per-user theme toggle, so there is no persisted
 *   preference to honour at first paint.
 * - Locale `lang`/`dir`/font: applied by the client-only
 *   `<LocaleHtmlAttributes>` effect mounted from `[locale]/layout.tsx`.
 *   Pre-hydration HTML uses the defaults set here (`lang="en"`, default
 *   font stack); crawlers still receive per-locale `<link rel="alternate" hreflang>`
 *   and `og:locale` metadata for SEO.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${outfit.variable} ${bricolageGrotesque.variable} ${jetbrainsMono.variable} ${notoSansArabic.variable} font-sans`}
      suppressHydrationWarning>
      <body data-intensity="exhibition">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
