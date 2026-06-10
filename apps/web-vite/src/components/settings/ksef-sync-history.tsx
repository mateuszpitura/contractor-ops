import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, History } from 'lucide-react';
import { tKey } from '../../i18n/typed-keys';
import type { useKsefSyncHistory as UseKsefSyncHistory } from './hooks/use-ksef-sync-history.js';
import { useKsefSyncHistory } from './hooks/use-ksef-sync-history.js';

const SYNC_STATUS_STYLES: Record<string, { className: string; labelKey: string }> = {
  SUCCESS: {
    className: 'bg-emerald-500/10 text-emerald-500',
    labelKey: 'syncStatusSuccess',
  },
  FAILED: {
    className: 'bg-destructive/10 text-destructive',
    labelKey: 'syncStatusFailed',
  },
  STARTED: {
    className: 'bg-blue-500/10 text-blue-500',
    labelKey: 'syncing',
  },
};

export type KsefSyncHistoryViewProps = ReturnType<typeof UseKsefSyncHistory>;

export function KsefSyncHistoryView({
  t,
  isOpen,
  setIsOpen,
  logs,
  isLoading,
}: KsefSyncHistoryViewProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <History className="size-4" aria-hidden="true" />
        <span>{t('syncHistoryTitle')}</span>
        <ChevronDown
          className={`ms-auto size-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={`skel-${i}`} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="ms-auto h-5 w-16" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('syncHistoryEmpty')}</p>
        ) : (
          <div className="divide-y">
            {logs.map(log => {
              const statusStyle = SYNC_STATUS_STYLES[log.status] ?? SYNC_STATUS_STYLES.STARTED;

              const payload = log.responsePayloadJson as Record<string, unknown> | null;
              const invoicesCreated = (payload?.invoicesCreated as number) ?? 0;

              const isNoNew = log.status === 'SUCCESS' && invoicesCreated === 0;

              return (
                <div key={log.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(log.startedAt), {
                      addSuffix: true,
                    })}
                  </span>

                  {!isNoNew && invoicesCreated > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {t('syncInvoiceCount', { count: invoicesCreated })}
                    </Badge>
                  )}

                  <Badge
                    variant="secondary"
                    className={`ms-auto text-xs ${
                      isNoNew ? 'bg-muted text-muted-foreground' : statusStyle.className
                    }`}>
                    {isNoNew ? t('syncStatusNoNew') : tKey(t, statusStyle.labelKey)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface KsefSyncHistoryProps {
  connectionId: string | undefined;
}

export function KsefSyncHistory({ connectionId }: KsefSyncHistoryProps) {
  const history = useKsefSyncHistory(connectionId);
  return <KsefSyncHistoryView {...history} />;
}
