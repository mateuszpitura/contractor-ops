import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PrivacyNoticePdfDownload } from './privacy-notice-pdf-download';
import { PrivacyNoticeToc } from './privacy-notice-toc';

export interface PrivacyNoticeLayoutProps {
  /** Jurisdiction the MDX content belongs to. Passed to the PDF download CTA
   *  so the call-to-action can localise the accessible label; the actual PDF
   *  jurisdiction is always derived server-side from the session. */
  jurisdiction: 'GB' | 'DE' | 'EU';
  /** Human-readable version + effective date line rendered under the title. */
  versionLabel?: string;
  children: ReactNode;
}

/**
 * Privacy-notice chrome shared by jurisdiction pages.
 * Renders skip-link, version header, PDF download CTA, TOC sidebar, main article.
 * Typography tokens come from `privacy-prose.tsx` — no Tailwind `prose`.
 */
export async function PrivacyNoticeLayout({
  jurisdiction,
  versionLabel,
  children,
}: PrivacyNoticeLayoutProps) {
  const t = await getTranslations('Legal.privacy');

  return (
    <>
      {/* Skip-link — first focusable element. WCAG 2.4.1 bypass blocks. */}
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
          <PrivacyNoticePdfDownload jurisdiction={jurisdiction} />
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
