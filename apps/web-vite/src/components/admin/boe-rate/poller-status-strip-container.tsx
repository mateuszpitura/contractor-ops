import { useBoeRatePollerStatus } from '../hooks/use-admin-boe-rate.js';
import { PollerStatusStripActive, PollerStatusStripEmpty } from './poller-status-strip.js';

/**
 * Decision: variant pick on poller hook flags.
 *
 * Renders nothing while the list query is loading (entries undefined),
 * the empty pill when there are no BOE_API entries, otherwise the
 * active poll-success pill. The view layer is single-render-path.
 */
export function PollerStatusStripContainer() {
  const { entries, apiEntries, latestApiEntry, rateChanged } = useBoeRatePollerStatus();

  if (!entries) return null;
  if (apiEntries.length === 0 || !latestApiEntry) return <PollerStatusStripEmpty />;

  return (
    <PollerStatusStripActive
      pollDate={new Date(latestApiEntry.createdAt).toISOString().slice(0, 10)}
      ratePercent={Number(latestApiEntry.ratePercent).toFixed(2)}
      rateChanged={rateChanged}
    />
  );
}
