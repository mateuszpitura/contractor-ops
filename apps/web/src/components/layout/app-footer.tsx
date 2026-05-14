'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Phase 56 · Plan 07 — persistent footer for the authenticated dashboard shell.
 *
 * UI-SPEC §Interaction 7:
 *   - Sits at the bottom of `<main>` (not fixed) so it scrolls into view.
 *   - Contains a locale-aware /legal/privacy link — "Datenschutz" on DE.
 *   - Tap targets ≥ 44×44 for WCAG 2.5.5 Target Size (Level AAA).
 *
 * Mounted only in `apps/web/src/app/[locale]/(dashboard)/layout.tsx` — does
 * NOT render on `/login`, the portal, or marketing pages.
 */
export function AppFooter() {
  const t = useTranslations('Layout.footer');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
        <Link
          href="/legal/privacy"
          className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t('privacy')}
        </Link>
        <Link
          href="/legal/terms"
          className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t('terms')}
        </Link>
        <span className="inline-flex min-h-[44px] items-center">© {year} Contractor Ops</span>
      </div>
    </footer>
  );
}
