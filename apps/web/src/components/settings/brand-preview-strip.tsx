'use client';

import { useTranslations } from 'next-intl';

interface BrandPreviewStripProps {
  color: string;
}

/**
 * Live preview strip showing how the selected brand color renders.
 * Displays a sample button, link, and accent bar in the chosen color.
 * Uses a CSS custom property to avoid inline styles while still applying dynamic color.
 */
export function BrandPreviewStrip({ color }: BrandPreviewStripProps) {
  const t = useTranslations('Settings.branding');

  const cssVars = { '--brand-preview-color': color } as React.CSSProperties;

  return (
    // biome-ignore lint/nursery/noInlineStyles: CSS custom property for dynamic brand color
    <div className="flex h-12 items-center gap-4 rounded-md bg-muted px-4" style={cssVars}>
      <span className="inline-flex items-center rounded-md bg-[var(--brand-preview-color)] px-3 py-1.5 text-sm font-medium text-white shadow-sm">
        {t('previewButton')}
      </span>

      <span className="text-sm text-[var(--brand-preview-color)] underline underline-offset-2">
        {t('previewLink')}
      </span>

      <div className="h-0.5 w-12 rounded-full bg-[var(--brand-preview-color)]" />
    </div>
  );
}
