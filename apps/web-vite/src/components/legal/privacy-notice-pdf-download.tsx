/**
 * Privacy-notice PDF download CTA. Step 11 codemod port from
 * apps/web/src/components/legal/privacy-notice-pdf-download.tsx:
 *   - `next-intl`     → `../../i18n/useTranslations.js`
 *   - `@/trpc/init`   → `../../providers/trpc-provider.js#useTRPC`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

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
