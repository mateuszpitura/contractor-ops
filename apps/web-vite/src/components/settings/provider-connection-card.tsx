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
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { addHours, formatDistanceToNow, isBefore } from 'date-fns';
import { Loader2, Unlink } from 'lucide-react';
import type { ReactNode } from 'react';
import { tDynLoose } from '../../i18n/typed-keys';
import type { useProviderConnectionCard } from './hooks/use-provider-connection-card.js';
import { ProviderDetailSheetContainer } from './provider-detail-sheet-container.js';

// ---------------------------------------------------------------------------
// Status badge styling per UI-SPEC semantic colors
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
// Token expiry display
// ---------------------------------------------------------------------------

function TokenExpiryBadge({ expiresAt }: { expiresAt: string | Date | null | undefined }) {
  if (!expiresAt) return null;

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const isExpired = isBefore(expiryDate, now);
  const isWarning = !isExpired && isBefore(expiryDate, addHours(now, 1));

  const colorClass = isExpired
    ? 'text-destructive'
    : isWarning
      ? 'text-amber-500'
      : 'text-emerald-500';

  const label = isExpired ? 'Expired' : `in ${formatDistanceToNow(expiryDate)}`;

  return <span className={`font-medium ${colorClass}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// ProviderConnectionCard
// ---------------------------------------------------------------------------

interface ProviderConnectionCardBaseProps {
  provider: string;
  displayName: string;
  icon: ReactNode;
  description: string;
  disconnectDialogOpen: boolean;
  setDisconnectDialogOpen: (open: boolean) => void;
  detailSheetOpen: boolean;
  setDetailSheetOpen: (open: boolean) => void;
}

export type ProviderConnectionCardProps = ProviderConnectionCardBaseProps &
  ReturnType<typeof useProviderConnectionCard>;

export function ProviderConnectionCard({
  provider,
  displayName,
  icon,
  description,
  disconnectDialogOpen,
  setDisconnectDialogOpen,
  detailSheetOpen,
  setDetailSheetOpen,
  t,
  isLoading,
  health,
  handleConnect,
  handleDisconnectConfirm,
  isDisconnectPending,
}: ProviderConnectionCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Determine connection state
  const connectionStatus = health?.status ?? 'DISCONNECTED';
  const isConnected = connectionStatus === 'CONNECTED';
  const isReauthRequired = connectionStatus === 'REAUTH_REQUIRED';
  const isError = connectionStatus === 'ERROR';

  const statusBadgeClass =
    STATUS_BADGE_CLASSES[connectionStatus] ?? STATUS_BADGE_CLASSES.DISCONNECTED;

  const statusLabelKey = STATUS_LABEL_KEYS[connectionStatus] ?? 'statusDisconnected';

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center">{icon}</span>
            <h4 className="text-base font-semibold">{displayName}</h4>
            <Badge variant="secondary" className={statusBadgeClass}>
              {tDynLoose(t, 'provider', statusLabelKey)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {/* Connected state */}
          {isConnected && !isReauthRequired && (
            <div className="flex flex-1 flex-col space-y-3">
              <div className="space-y-1 text-sm">
                {!!health?.displayName && (
                  <p>
                    <span className="text-muted-foreground">{t('provider.connectedTo')}:</span>{' '}
                    <span className="font-medium">{health.displayName}</span>
                  </p>
                )}
                {!!health?.connectedAt && (
                  <p>
                    <span className="text-muted-foreground">{t('provider.connectedOn')}:</span>{' '}
                    <span className="font-medium">
                      {new Date(health.connectedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
                {!!health?.tokenExpiresAt && (
                  <p>
                    <span className="text-muted-foreground">{t('provider.tokenExpires')}:</span>{' '}
                    <TokenExpiryBadge expiresAt={health.tokenExpiresAt} />
                  </p>
                )}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                <Button variant="outline" onClick={() => setDetailSheetOpen(true)}>
                  {t('provider.manageCta')}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDisconnectDialogOpen(true)}>
                  {t('provider.disconnectCta', { provider: displayName })}
                </Button>
              </div>
            </div>
          )}

          {/* Re-auth required state */}
          {!!(isReauthRequired || isError) && (
            <div className="flex flex-1 flex-col space-y-3">
              <p className="text-sm text-muted-foreground">
                {isReauthRequired
                  ? t('provider.errorTokenExpired')
                  : t('provider.errorConnectionFailed')}
              </p>
              <div className="mt-auto flex gap-2 pt-3">
                <Button variant="outline" onClick={handleConnect}>
                  {t('provider.reconnectCta')}
                </Button>
                {isReauthRequired && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDisconnectDialogOpen(true)}>
                    {t('provider.disconnectCta', { provider: displayName })}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Disconnected state */}
          {!(isConnected || isReauthRequired || isError) && (
            <div className="flex flex-1 flex-col space-y-3">
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="mt-auto pt-3">
                <Button onClick={handleConnect}>
                  {t('provider.connectCta', { provider: displayName })}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <ProviderDetailSheetContainer
        provider={provider}
        displayName={displayName}
        icon={icon}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />

      {/* Disconnect confirmation dialog */}
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
              onClick={handleDisconnectConfirm}>
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
