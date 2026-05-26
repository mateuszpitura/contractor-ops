import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useTransmissionsLogCard } from './hooks/use-transmissions-log-card.js';
import { TransmissionsLogCard } from './transmissions-log-card.js';

// Decision: data-table host — transmissions log card mounted by
// SettingsEInvoicingLogContainer; view delegates loading/empty row variants to the
// table shell and consumes the injected locale-aware date formatter.
export function TransmissionsLogCardContainer() {
  const { formatDate } = useDateFormatter();
  const card = useTransmissionsLogCard();
  return <TransmissionsLogCard formatDate={formatDate} {...card} />;
}
