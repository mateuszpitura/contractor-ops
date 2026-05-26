/**
 * Authenticated dashboard footer. Step 11 codemod port from
 * apps/web/src/components/layout/app-footer.tsx:
 *   - `next-intl`              → `../../i18n/useTranslations.js`
 *   - `@/i18n/navigation#Link` → `react-router-dom#Link`
 */

import { Link } from 'react-router-dom';

import { useTranslations } from '../../i18n/useTranslations.js';

export function AppFooter() {
  const t = useTranslations('Layout.footer');
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-border py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
        <Link
          to="legal/privacy"
          className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t('privacy')}
        </Link>
        <Link
          to="legal/terms"
          className="inline-flex min-h-[44px] items-center px-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t('terms')}
        </Link>
        <span className="inline-flex min-h-[44px] items-center">© {year} Contractor Ops</span>
      </div>
    </footer>
  );
}
