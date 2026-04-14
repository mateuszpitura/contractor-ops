import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

// Sentry: instrument client-side route transitions for performance tracing
export { onRouterTransitionStart } from '@/sentry.client.config';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${bricolageGrotesque.variable} ${jetbrainsMono.variable} font-sans`}
      suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered theme script with no user input
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme');
                if (theme === '"dark"' || theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
                let density = localStorage.getItem('density');
                if (density === '"compact"' || density === 'compact') {
                  document.documentElement.classList.add('density-compact');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
