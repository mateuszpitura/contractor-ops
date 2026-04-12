'use client';

import { useTranslations } from 'next-intl';

interface BrandPreviewStripProps {
  color: string;
}

/**
 * Live preview strip showing how the selected brand color renders.
 * Displays a sample button, link, and accent bar in the chosen color.
 */
export function BrandPreviewStrip({ color }: BrandPreviewStripProps) {
  const t = useTranslations('Settings.branding');

  return (
    <div className="flex h-12 items-center gap-4 rounded-md bg-muted px-4">
      <span
        className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm"
        style={{ backgroundColor: color }}>
        {t('previewButton')}
      </span>

      <span className="text-sm underline underline-offset-2" style={{ color }}>
        {t('previewLink')}
      </span>

      <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}
