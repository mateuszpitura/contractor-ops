// Decision: card section mounted by SettingsEInvoicingLogContainer (page composition). View
// internally branches on isLoading/isEmpty for the transmissions table; container injects locale-
// aware date formatter alongside hook return.
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useTransmissionsLogCard } from './hooks/use-transmissions-log-card.js';
import { TransmissionsLogCard } from './transmissions-log-card.js';

export function TransmissionsLogCardContainer() {
  const { formatDate } = useDateFormatter();
  const card = useTransmissionsLogCard();
  return <TransmissionsLogCard formatDate={formatDate} {...card} />;
}
