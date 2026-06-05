import { FlaskConical } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

/**
 * Persistent, read-only-mode banner shown at the top of the staff shell when
 * the active organization is a demo (env-controlled `isDemo` from
 * `organization.getCurrent`). Presentational only — the container decides
 * whether to render it.
 *
 * RTL-safe: uses logical properties (`gap`, `text-start`, no `ml-/mr-`) so it
 * mirrors correctly under `dir="rtl"` (ar). `role="status"` announces the
 * read-only context to assistive tech without stealing focus.
 */
export function DemoBanner() {
  const t = useTranslations('Layout.demo');

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:text-amber-200">
      <FlaskConical aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        <span className="font-semibold uppercase tracking-wide">{t('bannerLabel')}</span>
        <span className="px-1.5 opacity-60" aria-hidden="true">
          ·
        </span>
        <span>{t('bannerDescription')}</span>
      </span>
    </div>
  );
}
