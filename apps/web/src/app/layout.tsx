import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

// Phase 64 D-10 — register classification disclaimer gate at app boot
import '@/lib/feature-flags-init';
import { getThemeAttributes } from '@/lib/get-theme-attributes';

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

export const metadata: Metadata = {
  title: 'Contractor Ops',
  description: 'Contractor management and invoice processing platform',
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolve theme/density server-side from cookies. Removes the inline
  // <script dangerouslySetInnerHTML> block that previously read localStorage
  // pre-hydration — see `lib/get-theme-attributes.ts` for the FOUC trade-off
  // and Phase C.1.a in `goals/production-hardening/plan.md`.
  const { themeClass, densityClass } = await getThemeAttributes();

  const classes = [
    outfit.variable,
    bricolageGrotesque.variable,
    jetbrainsMono.variable,
    'font-sans',
    themeClass,
    densityClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang="en" className={classes} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
