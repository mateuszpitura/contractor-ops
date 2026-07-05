import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useState } from 'react';

import type { useTranslations } from '../../i18n/useTranslations.js';

type Provider = 'PERSONIO' | 'BAMBOOHR';

interface HrisSyncConnectCardProps {
  t: ReturnType<typeof useTranslations>;
  connected: boolean;
  provider?: string;
  status?: string;
  lastSyncAt?: Date | string | null;
  busy: boolean;
  onConnect: (input: { provider: Provider; accessToken: string }) => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
}

/** Presentational connect / disconnect / sync-now card for the org's HRIS. */
export function HrisSyncConnectCard({
  t,
  connected,
  provider,
  status,
  lastSyncAt,
  busy,
  onConnect,
  onDisconnect,
  onSyncNow,
}: HrisSyncConnectCardProps) {
  const [picked, setPicked] = useState<Provider>('PERSONIO');
  const [token, setToken] = useState('');

  if (connected) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t('connected.heading', { provider: provider ?? '' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('connected.status', { status: status ?? '' })}
              {lastSyncAt
                ? ` · ${t('connected.lastSync', { when: new Date(lastSyncAt).toLocaleString() })}`
                : ` · ${t('connected.neverSynced')}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSyncNow} disabled={busy}>
              {t('actions.syncNow')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDisconnect} disabled={busy}>
              {t('actions.disconnect')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-lg border bg-card p-5"
      onSubmit={event => {
        event.preventDefault();
        if (token.trim()) onConnect({ provider: picked, accessToken: token.trim() });
      }}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('connect.heading')}</p>
        <p className="text-xs text-muted-foreground">{t('connect.description')}</p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium">{t('connect.providerLabel')}</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={picked}
          onChange={event => setPicked(event.target.value as Provider)}>
          <option value="PERSONIO">Personio</option>
          <option value="BAMBOOHR">BambooHR</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium">{t('connect.tokenLabel')}</span>
        <input
          type="password"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={token}
          onChange={event => setToken(event.target.value)}
          placeholder={t('connect.tokenPlaceholder')}
          autoComplete="off"
        />
      </label>

      <Button type="submit" disabled={busy || !token.trim()}>
        {t('actions.connect')}
      </Button>
    </form>
  );
}
