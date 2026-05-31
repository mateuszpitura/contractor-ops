import type { ReactNode } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { PrivacyNoticeToc } from './privacy-notice-toc.js';

const LEGAL_DOCUMENTS = [
  { id: 'terms', href: 'legal/terms', labelKey: 'terms' },
  { id: 'privacy', href: 'legal/privacy', labelKey: 'privacy' },
  { id: 'sub-processors', href: 'legal/sub-processors', labelKey: 'subProcessors' },
  { id: 'breach-notification', href: 'legal/breach-notification', labelKey: 'breachNotification' },
] as const;

export type LegalDocumentId = (typeof LEGAL_DOCUMENTS)[number]['id'];

export interface LegalDocumentLayoutProps {
  current: LegalDocumentId;
  children: ReactNode;
  showToc?: boolean;
}

export function LegalDocumentLayout({
  current,
  children,
  showToc = true,
}: LegalDocumentLayoutProps) {
  const t = useTranslations('Legal');
  const tLayout = useTranslations('Layout');
  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div aria-hidden className="aurora-bg pointer-events-none fixed inset-0 opacity-35" />
      <div aria-hidden className="grain-overlay pointer-events-none fixed inset-0" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--background)_72%)]"
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg">
        {tLayout('skipToContent')}
      </a>

      <header className="relative z-10 border-b border-border/60 bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
            {t('nav.brand')}
          </p>
          <nav
            aria-label={t('nav.brand')}
            className="-mx-1 flex flex-wrap gap-1 overflow-x-auto pb-0.5 sm:justify-end">
            {LEGAL_DOCUMENTS.map(doc => {
              const isCurrent = doc.id === current;
              return (
                <Link
                  key={doc.id}
                  href={doc.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    isCurrent
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}>
                  {t(`nav.${doc.labelKey}`)}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 py-10 lg:py-14">
        <div
          className={cn(
            'grid gap-10',
            showToc && 'lg:grid-cols-[minmax(200px,240px)_1fr] lg:gap-14',
          )}>
          {showToc ? (
            <aside className="hidden lg:block">
              <PrivacyNoticeToc />
            </aside>
          ) : null}
          {/* biome-ignore lint/correctness/useUniqueElementIds: skip-link target for accessibility */}
          <main id="main" tabIndex={-1} className="min-w-0">
            <article className="glass-surface rounded-xl p-6 shadow-lg ring-1 ring-foreground/10 sm:p-8 lg:p-10">
              {children}
            </article>
          </main>
        </div>
      </div>

      <footer className="relative z-10 mt-auto border-t border-border/60 bg-background/85 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-xs text-muted-foreground">
          <Link
            href="legal/privacy"
            className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {tLayout('footer.privacy')}
          </Link>
          <Link
            href="legal/terms"
            className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {tLayout('footer.terms')}
          </Link>
          <span className="inline-flex min-h-[44px] items-center">© {year} Contractor Ops</span>
        </div>
      </footer>
    </div>
  );
}
