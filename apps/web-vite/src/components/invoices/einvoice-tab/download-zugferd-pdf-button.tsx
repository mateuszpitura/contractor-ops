/**
 * Download ZUGFeRD PDF button. Data layer → `hooks/use-download-zugferd-pdf.ts` + container.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';

interface DownloadZugferdPdfButtonProps {
  className?: string;
  onDownload: () => void;
  isPending: boolean;
}

export function DownloadZugferdPdfButton({
  className,
  onDownload,
  isPending,
}: DownloadZugferdPdfButtonProps) {
  const t = useTranslations('EInvoice.intake');

  return (
    <Button
      type="button"
      onClick={onDownload}
      disabled={isPending}
      className={className}
      data-testid="download-zugferd-pdf-button">
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{t('generatingLabel')}</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{t('ctaDownloadZugferd')}</span>
        </>
      )}
    </Button>
  );
}
