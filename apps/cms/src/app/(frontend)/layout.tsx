import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { getCmsEnv } from '@/lib/env';

import './styles.css';

export const metadata: Metadata = {
  title: {
    default: 'Contractor-Ops Blog',
    template: '%s · Contractor-Ops',
  },
  description:
    'Insights, product updates, and compliance guidance for cross-border independent contractors.',
  metadataBase: new URL(getCmsEnv().CMS_PUBLIC_URL),
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
