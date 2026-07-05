import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useHrisSync } from './hooks/use-hris-sync.js';
import { HrisSyncConnectCard } from './hris-sync-connect-card.js';
import { HrisSyncMappingTable } from './hris-sync-mapping-table.js';

/**
 * Section container for the HRIS sync settings surface. Owns the loading /
 * empty / error branches and wires the presentational cards to the hook.
 */
export function HrisSyncSettingsContainer() {
  const { t, status, isLoading, isError, refetch, connect, disconnect, syncNow, setMapping } =
    useHrisSync();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">{t('error.heading')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('error.description')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  const busy =
    connect.isPending || disconnect.isPending || syncNow.isPending || setMapping.isPending;
  const connected = status.connected;
  const mapping = connected ? (status.config?.mapping.standard ?? {}) : {};

  return (
    <div className="space-y-6">
      <HrisSyncConnectCard
        t={t}
        connected={connected}
        provider={connected ? status.provider : undefined}
        status={connected ? status.status : undefined}
        lastSyncAt={connected ? status.lastSyncAt : undefined}
        busy={busy}
        onConnect={input => connect.mutate(input)}
        onDisconnect={() => disconnect.mutate()}
        onSyncNow={() => syncNow.mutate()}
      />

      {!connected && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">{t('empty.heading')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('empty.description')}</p>
        </div>
      )}

      {connected && (
        <HrisSyncMappingTable
          t={t}
          mapping={mapping}
          busy={busy}
          onSave={next => setMapping.mutate({ mapping: { standard: next } })}
        />
      )}
    </div>
  );
}
