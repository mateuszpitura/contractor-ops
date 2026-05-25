import { useIr35ChainPanel } from '../hooks/use-ir35-chain.js';
import { Ir35ChainPanelEmpty, Ir35ChainPanelView } from './ir35-chain-panel.js';

interface Ir35ChainPanelContainerProps {
  engagementId: string;
}

export function Ir35ChainPanelContainer({ engagementId }: Ir35ChainPanelContainerProps) {
  const { rows, markDelivered, markAcknowledged, removeParticipant } =
    useIr35ChainPanel(engagementId);

  if (rows.length === 0) return <Ir35ChainPanelEmpty engagementId={engagementId} />;

  return (
    <Ir35ChainPanelView
      engagementId={engagementId}
      rows={rows}
      markDelivered={markDelivered}
      markAcknowledged={markAcknowledged}
      removeParticipant={removeParticipant}
    />
  );
}
