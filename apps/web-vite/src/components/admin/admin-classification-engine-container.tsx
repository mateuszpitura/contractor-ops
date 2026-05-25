import { ClassificationEnginePanel } from './classification-engine/classification-engine-panel.js';
import { useAdminClassificationEngine } from './hooks/use-admin-classification-engine.js';

export function AdminClassificationEngineContainer() {
  const state = useAdminClassificationEngine();
  return <ClassificationEnginePanel state={state} />;
}
