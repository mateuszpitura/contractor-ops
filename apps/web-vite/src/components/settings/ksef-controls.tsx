import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Loader2 } from 'lucide-react';
import type { useKsefControls as UseKsefControls } from './hooks/use-integrations-tab.js';
import { useKsefControls } from './hooks/use-integrations-tab.js';
import { KsefSyncHistory } from './ksef-sync-history.js';

export type KsefControlsProps = ReturnType<typeof UseKsefControls>;

export function KsefControlsView({ t, connection, isPending, handleSync }: KsefControlsProps) {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
        {!!isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />}
        {isPending ? t('syncing') : t('syncNow')}
      </Button>

      <KsefSyncHistory connectionId={connection?.id} />
    </div>
  );
}

export function KsefControls() {
  const controls = useKsefControls();
  return <KsefControlsView {...controls} />;
}
