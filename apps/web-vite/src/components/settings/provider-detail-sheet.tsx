import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { addHours, formatDistanceToNow, isBefore } from 'date-fns';
import { Loader2, Unlink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { tDynLoose } from '../../i18n/typed-keys';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { useProviderDetailSheet } from './hooks/use-provider-detail-sheet.js';

// ---------------------------------------------------------------------------
// Status badge styling (shared with ProviderConnectionCard)
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASSES: Record<string, string> = {
  CONNECTED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  ERROR: 'bg-destructive/10 text-destructive',
  REAUTH_REQUIRED: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  CONNECTED: 'statusConnected',
  DISCONNECTED: 'statusDisconnected',
  ERROR: 'statusError',
  REAUTH_REQUIRED: 'statusReauth',
};

// ---------------------------------------------------------------------------
// Sync status dot colors
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'SUCCESS' || status === 'PROCESSED'
      ? 'bg-emerald-500'
      : status === 'FAILED'
        ? 'bg-destructive'
        : 'bg-amber-500';

  return <span className={`inline-block size-2 rounded-full ${colorClass}`} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

function formatDuration(startedAt: Date | string, completedAt: Date | string | null): string {
  if (!completedAt) return '--';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;

  if (diffMs < 1000) return `${diffMs}ms`;
  if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
  return `${(diffMs / 60000).toFixed(1)}m`;
}

// ---------------------------------------------------------------------------
// Token expiry display
// ---------------------------------------------------------------------------

function TokenExpiryDisplay({ expiresAt }: { expiresAt: string | Date | null | undefined }) {
  const t = useTranslations('Settings.integrations');

  if (!expiresAt) return <span className="text-muted-foreground">--</span>;

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const isExpired = isBefore(expiryDate, now);
  const isWarning = !isExpired && isBefore(expiryDate, addHours(now, 1));

  const colorClass = isExpired
    ? 'text-destructive'
    : isWarning
      ? 'text-amber-500'
      : 'text-emerald-500';

  const label = isExpired
    ? t('provider.tokenExpiryExpired')
    : `in ${formatDistanceToNow(expiryDate)}`;

  return <span className={colorClass}>{label}</span>;
}

// ---------------------------------------------------------------------------
// ProviderDetailSheet
// ---------------------------------------------------------------------------

interface ProviderDetailSheetShellProps {
  provider: string;
  displayName: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disconnectDialogOpen: boolean;
  setDisconnectDialogOpen: (open: boolean) => void;
}

export type ProviderDetailSheetProps = ProviderDetailSheetShellProps &
  ReturnType<typeof useProviderDetailSheet>;

export function ProviderDetailSheet({
  provider,
  displayName,
  icon,
  open,
  onOpenChange,
  disconnectDialogOpen,
  setDisconnectDialogOpen,
  t,
  health,
  connectionStatus,
  syncItems,
  syncLogQuery,
  handleLoadMoreSync,
  webhookItems,
  webhookLogQuery,
  handleLoadMoreWebhook,
  handleReauthorize,
  handleDisconnect,
  isDisconnectPending,
}: ProviderDetailSheetProps) {
  const statusBadgeClass =
    STATUS_BADGE_CLASSES[connectionStatus] ?? STATUS_BADGE_CLASSES.DISCONNECTED;
  const statusLabelKey = STATUS_LABEL_KEYS[connectionStatus] ?? 'statusDisconnected';

  const handleOpenDisconnect = useCallback(
    () => setDisconnectDialogOpen(true),
    [setDisconnectDialogOpen],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center">{icon}</span>
              <SheetTitle className="text-base font-semibold">{displayName}</SheetTitle>
              <Badge variant="secondary" className={statusBadgeClass}>
                {tDynLoose(t, 'provider', statusLabelKey)}
              </Badge>
            </div>
            <SheetDescription className="sr-only">
              {t('provider.connectionDetails')} - {displayName}
            </SheetDescription>
            <div className="flex gap-2 pt-2">
              {(connectionStatus === 'REAUTH_REQUIRED' || connectionStatus === 'ERROR') && (
                <Button variant="outline" size="sm" onClick={handleReauthorize}>
                  {t('provider.reconnectCta')}
                </Button>
              )}
              {connectionStatus !== 'DISCONNECTED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleOpenDisconnect}>
                  {t('provider.disconnectCta', { provider: displayName })}
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Connection Details Section */}
          <div className="space-y-6 px-4 pb-6">
            <section>
              <h3 className="text-sm font-semibold mb-3">{t('provider.connectionDetails')}</h3>
              <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('provider.status')}</dt>
                <dd>
                  <Badge variant="secondary" className={statusBadgeClass}>
                    {tDynLoose(t, 'provider', statusLabelKey)}
                  </Badge>
                </dd>

                {!!health?.connectedAt && (
                  <>
                    <dt className="text-muted-foreground">{t('provider.connectedOn')}</dt>
                    <dd>{new Date(health.connectedAt).toLocaleDateString()}</dd>
                  </>
                )}

                {!!health?.displayName && (
                  <>
                    <dt className="text-muted-foreground">{t('provider.connectedTo')}</dt>
                    <dd className="font-medium">{health.displayName}</dd>
                  </>
                )}

                <dt className="text-muted-foreground">{t('provider.tokenExpires')}</dt>
                <dd>
                  <TokenExpiryDisplay expiresAt={health?.tokenExpiresAt} />
                </dd>

                {!!health?.lastSyncAt && (
                  <>
                    <dt className="text-muted-foreground">{t('provider.lastRefresh')}</dt>
                    <dd>{formatDistanceToNow(new Date(health.lastSyncAt))} ago</dd>
                  </>
                )}
              </dl>
            </section>

            {/* Sync Log Section */}
            <section>
              <h3 className="text-sm font-semibold mb-3">{t('provider.syncLogHeading')}</h3>
              {syncItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('provider.syncLogEmpty')}</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('provider.syncLogTimestamp')}</TableHead>
                        <TableHead>{t('provider.syncLogAction')}</TableHead>
                        <TableHead>{t('provider.syncLogStatus')}</TableHead>
                        <TableHead>{t('provider.syncLogDuration')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncItems.map(item => (
                        <TableRow
                          key={item.id}
                          className={item.status === 'FAILED' ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs">
                            {new Date(item.startedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">{item.syncType}</TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot status={item.status} />
                              {item.status === 'SUCCESS'
                                ? 'Success'
                                : item.status === 'FAILED'
                                  ? 'Failed'
                                  : 'Started'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDuration(item.startedAt, item.completedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!!syncLogQuery.data?.nextCursor && (
                    <div className="mt-2 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMoreSync}
                        disabled={syncLogQuery.isFetching}>
                        {!!syncLogQuery.isFetching && (
                          <Loader2 className="me-1.5 size-3.5 animate-spin" />
                        )}
                        {t('provider.loadMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Webhook Deliveries Section */}
            <section>
              <h3 className="text-sm font-semibold mb-3">{t('provider.webhookLogHeading')}</h3>
              {webhookItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('provider.webhookLogEmpty')}</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('provider.webhookLogReceived')}</TableHead>
                        <TableHead>{t('provider.webhookLogEventType')}</TableHead>
                        <TableHead>{t('provider.webhookLogStatus')}</TableHead>
                        <TableHead>{t('provider.webhookLogProcessingTime')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            {new Date(item.receivedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{item.eventType}</TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot status={item.deliveryStatus} />
                              {item.deliveryStatus === 'PROCESSED'
                                ? 'Delivered'
                                : item.deliveryStatus === 'FAILED'
                                  ? 'Failed'
                                  : item.deliveryStatus === 'PROCESSING'
                                    ? 'Processing'
                                    : 'Received'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDuration(item.receivedAt, item.processedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!!webhookLogQuery.data?.nextCursor && (
                    <div className="mt-2 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMoreWebhook}
                        disabled={webhookLogQuery.isFetching}>
                        {!!webhookLogQuery.isFetching && (
                          <Loader2 className="me-1.5 size-3.5 animate-spin" />
                        )}
                        {t('provider.loadMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Disconnect confirmation dialog (from sheet) */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink className="size-4" />
              {t('disconnectConfirmGeneric.title', {
                provider: displayName,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('disconnectConfirmGeneric.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('disconnectConfirmGeneric.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDisconnectPending}
              onClick={handleDisconnect}>
              {!!isDisconnectPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('disconnectConfirmGeneric.confirm', {
                provider: displayName,
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
