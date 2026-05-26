/**
 * Suspense fallback spinner. Step 11 codemod port from
 * apps/web/src/components/shared/page-loading-spinner.tsx:
 *   - `next-intl`  → `../../i18n/useTranslations.js`
 */

import { Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export function PageLoadingSpinner() {
  const t = useTranslations('Common');
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
