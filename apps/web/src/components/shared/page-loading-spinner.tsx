'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Minimal centered spinner used as a Suspense fallback for dashboard data
 * pages. Renders only during the brief window between initial paint and
 * client hydration. Once the client component mounts, the rich loading
 * state (real chrome + DataTableBody skeleton rows + AtelierTableShell
 * overlay) takes over inside the page.
 */
export function PageLoadingSpinner() {
  const t = useTranslations('Common');

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      // Fills the dashboard <main> content area minus the topbar + padding
      // chrome (~8rem total) so the spinner sits in the visual centre of
      // the viewport, not the middle of a short box.
      className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
