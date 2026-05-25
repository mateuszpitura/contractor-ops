import { useClassificationDashboardCsvExport } from '../hooks/use-classification-dashboard.js';
import type { DownloadCsvButtonViewProps } from './download-csv-button.js';
import { DownloadCsvButtonView } from './download-csv-button.js';

// Decision: render gated externally by parent (MarketCardView mounts unconditionally).
// This container's job is to keep the exportMarketCsv mutation out of the view.
export function DownloadCsvButtonContainer(props: Pick<DownloadCsvButtonViewProps, 'market'>) {
  const { exportCsv, isPending } = useClassificationDashboardCsvExport(props.market);
  return <DownloadCsvButtonView market={props.market} onExport={exportCsv} isPending={isPending} />;
}
