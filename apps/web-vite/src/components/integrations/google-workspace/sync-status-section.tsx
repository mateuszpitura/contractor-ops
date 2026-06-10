import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { useSyncStatusSection } from './hooks/use-sync-status-section.js';

export type SyncStatusSectionViewProps = Pick<
  ReturnType<typeof useSyncStatusSection>,
  'syncStatus' | 'triggerSyncMutation' | 'handleTriggerSync' | 't'
> & {
  onImportClick: () => void;
};

export function SyncStatusSectionSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
      </CardContent>
    </Card>
  );
}

export function SyncStatusSectionView({
  onImportClick,
  syncStatus,
  triggerSyncMutation,
  handleTriggerSync,
  t,
}: SyncStatusSectionViewProps) {
  const lastSyncLabel = syncStatus?.lastSyncAt
    ? t('lastSynced', {
        time: formatDistanceToNow(new Date(syncStatus.lastSyncAt), {
          addSuffix: true,
        }),
      })
    : null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        <div className="flex-1 space-y-0.5 text-sm">
          {!!lastSyncLabel && <p className="text-muted-foreground">{lastSyncLabel}</p>}
          <p className="text-muted-foreground">{t('nextSync')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerSync}
            disabled={triggerSyncMutation.isPending}>
            {!!triggerSyncMutation.isPending && (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            )}
            {triggerSyncMutation.isPending ? t('syncing') : t('syncNow')}
          </Button>

          <Button variant="outline" size="sm" onClick={onImportClick}>
            {t('importUsers')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SyncStatusSectionProps {
  onImportClick: () => void;
}

export function SyncStatusSection({ onImportClick }: SyncStatusSectionProps) {
  const {
    syncStatusQuery,
    syncStatus,
    isError,
    onRetry,
    triggerSyncMutation,
    handleTriggerSync,
    t,
  } = useSyncStatusSection();
  if (syncStatusQuery.isLoading) return <SyncStatusSectionSkeleton />;
  if (isError) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 p-4" role="alert">
        <p className="text-sm text-destructive">{t('syncError')}</p>
        <button type="button" className="text-sm underline" onClick={onRetry}>
          {t('syncNow')}
        </button>
      </div>
    );
  }
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
