import { useKsefControls } from './hooks/use-integrations-tab.js';
import { KsefControls } from './ksef-controls.js';

export function KsefControlsContainer() {
  const controls = useKsefControls();
  if (!controls.isConnected) return null;
  return <KsefControls {...controls} />;
}
