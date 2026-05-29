import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Loader2 } from 'lucide-react';

import type { useKsefControls } from './hooks/use-integrations-tab.js';
import { KsefSyncHistoryContainer } from './ksef-sync-history-container.js';

export type KsefControlsProps = ReturnType<typeof useKsefControls>;

export function KsefControls({ t, connection, isPending, handleSync }: KsefControlsProps) {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
        {!!isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />}
        {isPending ? t('syncing') : t('syncNow')}
      </Button>

      <KsefSyncHistoryContainer connectionId={connection?.id} />
    </div>
  );
}
