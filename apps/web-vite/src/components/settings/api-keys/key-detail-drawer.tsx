import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo } from 'react';
import type { TranslateFn } from '../../../i18n/useTranslations.js';
import { useKeyDetail } from '../hooks/use-api-keys-tab.js';

export interface KeyDetailRow {
  id: string;
  name: string;
  scopes: readonly string[];
  lastUsedAt?: string | Date | null;
  actingUserId?: string | null;
  actingUser?: { id: string; name: string | null } | null;
}

interface KeyDetailDrawerProps {
  apiKey: KeyDetailRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Group granular `resource:action` scopes into `{ resource: { read, write } }`. */
function groupScopes(scopes: readonly string[]) {
  const groups = new Map<string, { read: boolean; write: boolean }>();
  for (const scope of scopes) {
    const [resource, action] = scope.split(':');
    if (!(resource && action)) continue;
    const entry = groups.get(resource) ?? { read: false, write: false };
    if (action === 'read') entry.read = true;
    else entry.write = true;
    groups.set(resource, entry);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function KeyDetailDrawer({ apiKey, open, onOpenChange }: KeyDetailDrawerProps) {
  const { t, ipLogQuery, usageQuery, membersQuery, rebindMutation, rebind } = useKeyDetail(
    apiKey.id,
  );
  const scopeGroups = useMemo(() => groupScopes(apiKey.scopes), [apiKey.scopes]);

  const handleRebind = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value && value !== apiKey.actingUserId) rebind(value);
    },
    [apiKey.actingUserId, rebind],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{apiKey.name}</DialogTitle>
          <DialogDescription>{t('detail.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Scope visualization */}
          <section className="space-y-2">
            <h4 className="text-sm font-medium">{t('detail.scopesHeading')}</h4>
            {scopeGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('detail.scopesEmpty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {scopeGroups.map(([resource, { read, write }]) => (
                  <li key={resource} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{resource}</span>
                    <span className="flex gap-1.5">
                      {read && <Badge variant="secondary">{t('detail.scopeRead')}</Badge>}
                      {write && <Badge>{t('detail.scopeWrite')}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Acting user binding (view + rebind) */}
          <section className="space-y-2">
            <h4 className="text-sm font-medium">{t('detail.actingUserHeading')}</h4>
            <p className="text-xs text-muted-foreground">{t('detail.actingUserHelp')}</p>
            {membersQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : membersQuery.isError ? (
              <ErrorLine text={t('detail.membersError')} />
            ) : (
              <select
                aria-label={t('detail.actingUserHeading')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={apiKey.actingUserId ?? ''}
                onChange={handleRebind}
                disabled={rebindMutation.isPending}>
                {(membersQuery.data ?? []).map(m => (
                  <option key={String(m.userId)} value={String(m.userId)}>
                    {String(m.name ?? m.email ?? m.userId)}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Monthly usage vs quota */}
          <section className="space-y-2">
            <h4 className="text-sm font-medium">{t('detail.usageHeading')}</h4>
            {usageQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : usageQuery.isError ? (
              <ErrorLine text={t('detail.usageError')} />
            ) : (
              <UsageBar
                count={usageQuery.data?.count ?? 0}
                quota={usageQuery.data?.quota ?? null}
                t={t}
              />
            )}
          </section>

          {/* Source-IP log */}
          <section className="space-y-2">
            <h4 className="text-sm font-medium">{t('detail.ipLogHeading')}</h4>
            {ipLogQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : ipLogQuery.isError ? (
              <ErrorLine text={t('detail.ipLogError')} />
            ) : (ipLogQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('detail.ipLogEmpty')}</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {(ipLogQuery.data ?? []).map(event => (
                  <li key={event.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <code className="font-mono text-xs">{event.ipAddress}</code>
                    <time className="text-xs text-muted-foreground" dateTime={String(event.seenAt)}>
                      {new Date(event.seenAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogBody>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('detail.closeButton')}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertTriangle className="size-3.5" aria-hidden />
      {text}
    </p>
  );
}

function UsageBar({ count, quota, t }: { count: number; quota: number | null; t: TranslateFn }) {
  if (quota == null) {
    return <p className="text-sm">{t('detail.usageUnlimited', { count })}</p>;
  }
  const pct = Math.min(100, Math.round((count / Math.max(1, quota)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('detail.usageCount', { count, quota })}</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={quota}>
        <div
          className={pct >= 100 ? 'h-full bg-destructive' : 'h-full bg-primary'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
