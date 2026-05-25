/**
 * Classification dashboard CSV download. Step 11 codemod port from
 * apps/web/src/components/contractors/classification/dashboard/download-csv-button.tsx:
 *   - `next-intl`     → `../../../../i18n/useTranslations.js`
 *   - `@/trpc/init`   → `../../../../providers/trpc-provider.js#useTRPC`
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';

import { useTranslations } from '../../../../i18n/useTranslations.js';

export interface DownloadCsvButtonViewProps {
  market: 'GB' | 'DE';
  onExport: () => void;
  isPending: boolean;
}

export function DownloadCsvButtonView({ market, onExport, isPending }: DownloadCsvButtonViewProps) {
  const t = useTranslations('Classification.polish.dashboard');

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={onExport}
      aria-label={t('downloadCsv')}
      data-market={market}
      data-testid={`download-csv-${market.toLowerCase()}`}>
      {isPending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      <span>{isPending ? t('downloadingLabel') : t('downloadCsv')}</span>
    </Button>
  );
}
