/**
 * Privacy-notice chrome shared by jurisdiction pages.
 */

import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { PrivacyNoticePdfDownloadWired } from './privacy-notice-pdf-download.js';

import { PrivacyNoticeToc } from './privacy-notice-toc.js';

export interface PrivacyNoticeLayoutProps {
  jurisdiction: 'GB' | 'DE' | 'EU';
  versionLabel?: string;
  children: ReactNode;
}

export function PrivacyNoticeLayout({
  jurisdiction,
  versionLabel,
  children,
}: PrivacyNoticeLayoutProps) {
  const t = useTranslations('Legal.privacy');

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg">
        {t('skipToContent')}
      </a>

      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {versionLabel ? <p className="text-sm text-muted-foreground">{versionLabel}</p> : null}
          </div>
          <PrivacyNoticePdfDownloadWired jurisdiction={jurisdiction} />
        </header>

        <div className="grid gap-12 lg:grid-cols-[minmax(220px,260px)_1fr]">
          <aside className="hidden lg:block">
            <PrivacyNoticeToc />
          </aside>
          {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link target for accessibility */}
          <main id="main" className="min-w-0" tabIndex={-1}>
            <article>{children}</article>
          </main>
        </div>
      </div>
    </>
  );
}
