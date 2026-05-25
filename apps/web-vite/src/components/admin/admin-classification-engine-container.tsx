import {
  ClassificationEnginePanelHeader,
  ClassificationOverrideBanner,
  DisclaimerRegistryTable,
  FlagStatusCard,
  RegistryStatusCard,
} from './classification-engine/classification-engine-panel.js';
import { useAdminClassificationEngine } from './hooks/use-admin-classification-engine.js';

/**
 * Decision: composition + variant pick.
 *
 * Composes four sibling sections (header, two status cards, optional
 * override banner, disclaimer registry table) and gates the override
 * banner on `isOverridden`. View files own no internal layout-level
 * branching.
 */
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
