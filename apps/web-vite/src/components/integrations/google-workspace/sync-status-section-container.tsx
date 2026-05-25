import { useSyncStatusSection } from './hooks/use-sync-status-section.js';
import { SyncStatusSectionSkeleton, SyncStatusSectionView } from './sync-status-section.js';

interface SyncStatusSectionProps {
  onImportClick: () => void;
}

export function SyncStatusSection({ onImportClick }: SyncStatusSectionProps) {
  const { syncStatusQuery, syncStatus, triggerSyncMutation, handleTriggerSync, t } =
    useSyncStatusSection();
  if (syncStatusQuery.isLoading) return <SyncStatusSectionSkeleton />;
  if (!syncStatus?.connected) return null;
  return (
    <SyncStatusSectionView
      onImportClick={onImportClick}
      syncStatus={syncStatus}
      triggerSyncMutation={triggerSyncMutation}
      handleTriggerSync={handleTriggerSync}
      t={t}
    />
  );
}
