/**
 * Classification dashboard CSV download.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Download, Loader2 } from 'lucide-react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useClassificationDashboardCsvExport } from '../hooks/use-classification-dashboard.js';

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

export function DownloadCsvButton(props: Pick<DownloadCsvButtonViewProps, 'market'>) {
  const { exportCsv, isPending } = useClassificationDashboardCsvExport(props.market);
  return <DownloadCsvButtonView market={props.market} onExport={exportCsv} isPending={isPending} />;
}
