/**
 * Privacy-notice PDF download CTA.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useLegalPrivacyPdfDownload } from './hooks/use-legal-privacy-pdf.js';

export interface PrivacyNoticePdfDownloadProps {
  jurisdiction: 'GB' | 'DE' | 'EU';
  isPending: boolean;
  onDownload: () => void;
}

export function PrivacyNoticePdfDownload({
  jurisdiction: _jurisdiction,
  isPending,
  onDownload,
}: PrivacyNoticePdfDownloadProps) {
  const t = useTranslations('Legal.privacy');

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-[44px] gap-2"
      onClick={onDownload}
      disabled={isPending}
      aria-label={t('downloadAsPdfAriaLabel')}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {t('downloadAsPdf')}
    </Button>
  );
}

export interface PrivacyNoticePdfDownloadWiredProps {
  jurisdiction: 'GB' | 'DE' | 'EU';
}

export function PrivacyNoticePdfDownloadWired({
  jurisdiction,
}: PrivacyNoticePdfDownloadWiredProps) {
  const { mutation } = useLegalPrivacyPdfDownload();
  const handleDownload = useCallback(() => mutation.mutate(undefined), [mutation]);
  return (
    <PrivacyNoticePdfDownload
      jurisdiction={jurisdiction}
      isPending={mutation.isPending}
      onDownload={handleDownload}
    />
  );
}
