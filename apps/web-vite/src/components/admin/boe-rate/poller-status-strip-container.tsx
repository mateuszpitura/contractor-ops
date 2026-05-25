import { useBoeRatePollerStatus } from '../hooks/use-admin-boe-rate.js';
import { PollerStatusStrip } from './poller-status-strip.js';

export function PollerStatusStripContainer() {
  const poller = useBoeRatePollerStatus();
  return <PollerStatusStrip poller={poller} />;
}
