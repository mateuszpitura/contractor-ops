import { usePeppolTransmissionStatus } from './hooks/use-peppol.js';
import type { PeppolTransmissionStatusProps } from './peppol-transmission-status.js';
import {
  PeppolTransmissionTimeline,
  PeppolTransmissionTimelineFailed,
} from './peppol-transmission-status.js';

export function PeppolTransmissionStatusContainer({ transmission }: PeppolTransmissionStatusProps) {
  const tx = usePeppolTransmissionStatus({
    transmissionId: transmission.id,
    status: transmission.status,
  });

  if (tx.isFailed) {
    return (
      <PeppolTransmissionTimelineFailed
        transmission={transmission}
        onRetry={tx.onRetry}
        isRetrying={tx.isRetrying}
      />
    );
  }

  return <PeppolTransmissionTimeline transmission={transmission} />;
}
