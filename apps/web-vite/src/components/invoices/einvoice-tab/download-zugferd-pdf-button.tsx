/**
 * Download ZUGFeRD PDF button.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDownloadZugferdPdf } from '../hooks/use-download-zugferd-pdf.js';

interface DownloadZugferdPdfButtonViewProps {
  className?: string;
  onDownload: () => void;
  isPending: boolean;
}

export function DownloadZugferdPdfButtonView({
  className,
  onDownload,
  isPending,
}: DownloadZugferdPdfButtonViewProps) {
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

interface DownloadZugferdPdfButtonProps {
  invoiceId: string;
  className?: string;
}

export function DownloadZugferdPdfButton({ invoiceId, className }: DownloadZugferdPdfButtonProps) {
  const { onDownload, isPending } = useDownloadZugferdPdf(invoiceId);
  return (
    <DownloadZugferdPdfButtonView className={className} onDownload={onDownload} isPending={isPending} />
  );
}
