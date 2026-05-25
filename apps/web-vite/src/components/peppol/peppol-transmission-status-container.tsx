import { usePeppolTransmissionStatus } from './hooks/use-peppol.js';
import type { PeppolTransmissionStatusProps } from './peppol-transmission-status.js';
import { PeppolTransmissionStatusView } from './peppol-transmission-status.js';

export function PeppolTransmissionStatusContainer({ transmission }: PeppolTransmissionStatusProps) {
  const tx = usePeppolTransmissionStatus({
    transmissionId: transmission.id,
    status: transmission.status,
  });
  return (
    <PeppolTransmissionStatusView
      transmission={transmission}
      isFailed={tx.isFailed}
      onRetry={tx.onRetry}
      isRetrying={tx.isRetrying}
    />
  );
}
