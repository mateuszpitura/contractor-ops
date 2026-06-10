/**
 * Admin classification engine — route shell with inlined page content.
 */

import { Suspense } from 'react';

import {
  ClassificationEnginePanelHeader,
  ClassificationOverrideBanner,
  DisclaimerRegistryTable,
  FlagStatusCard,
  RegistryStatusCard,
} from '../../components/admin/classification-engine/classification-engine-panel.js';
import { useAdminClassificationEngine } from '../../components/admin/hooks/use-admin-classification-engine.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';

function ClassificationEnginePageContent() {
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

export default function ClassificationEngineFlagPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ClassificationEnginePageContent />
    </Suspense>
  );
}
