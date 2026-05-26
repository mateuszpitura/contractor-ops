import {
  ClassificationEnginePanelHeader,
  ClassificationOverrideBanner,
  DisclaimerRegistryTable,
  FlagStatusCard,
  RegistryStatusCard,
} from './classification-engine/classification-engine-panel.js';
import { useAdminClassificationEngine } from './hooks/use-admin-classification-engine.js';

export function AdminClassificationEngineContainer() {
  const { flagEnabled, pendingCount, totalCount, isOverridden, rows } =
    useAdminClassificationEngine();

  return (
    <div className="space-y-8 p-6">
      <ClassificationEnginePanelHeader />
      <div className="grid gap-4 sm:grid-cols-2">
        <FlagStatusCard flagEnabled={flagEnabled} />
        <RegistryStatusCard pendingCount={pendingCount} totalCount={totalCount} />
      </div>
      {isOverridden ? <ClassificationOverrideBanner pendingCount={pendingCount} /> : null}
      <DisclaimerRegistryTable rows={rows} />
    </div>
  );
}
