import { useClassificationDashboardCsvExport } from '../hooks/use-classification-dashboard.js';
import type { DownloadCsvButtonViewProps } from './download-csv-button.js';
import { DownloadCsvButtonView } from './download-csv-button.js';

// Decision: mutation host — exportMarketCsv isolated from view; MarketCardView
// composes this button unconditionally.
export function DownloadCsvButtonContainer(props: Pick<DownloadCsvButtonViewProps, 'market'>) {
  const { exportCsv, isPending } = useClassificationDashboardCsvExport(props.market);
  return <DownloadCsvButtonView market={props.market} onExport={exportCsv} isPending={isPending} />;
}
