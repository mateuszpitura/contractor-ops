'use client';

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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addHours, formatDistanceToNow, isBefore } from 'date-fns';
import { Loader2, Unlink } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { tDynLoose } from '@/i18n/typed-keys';
import { trpc } from '@/trpc/init';
import { ProviderDetailSheet } from './provider-detail-sheet';

// ---------------------------------------------------------------------------
// Status badge styling per UI-SPEC semantic colors
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASSES: Record<string, string> = {
  CONNECTED: 'bg-emerald-500/10 text-emerald-500',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  ERROR: 'bg-destructive/10 text-destructive',
  REAUTH_REQUIRED: 'bg-amber-500/10 text-amber-500',
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

interface ProviderConnectionCardProps {
  /** Provider slug (e.g., "slack") */
  provider: string;
  /** Human-readable display name (e.g., "Slack") */
  displayName: string;
  /** Provider logo icon (32x32) */
  icon: ReactNode;
  /** Description shown when disconnected */
  description: string;
}

export function ProviderConnectionCard({
  provider,
  displayName,
  icon,
  description,
}: ProviderConnectionCardProps) {
  const t = useTranslations('Settings.integrations');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // ---- Data fetching with 30-second polling (D-10) ----
  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider }, { refetchInterval: 30000 }),
  );
  const health = healthQuery.data;

  // ---- Handle OAuth callback result ----
  useEffect(() => {
    const param = searchParams.get(provider);
    if (param === 'connected') {
      toast.success(t('providerToasts.connected', { provider: displayName }));
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getHealth.queryKey({ provider }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getAllHealth.queryKey(),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete(provider);
      window.history.replaceState({}, '', url.toString());
    } else if (param === 'error') {
      toast.error(t('providerToasts.connectFailed', { provider: displayName }));
      const url = new URL(window.location.href);
      url.searchParams.delete(provider);
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, provider, displayName, t, queryClient]);

  // ---- Disconnect mutations ----
  // Common handlers shared across provider-specific disconnect mutations.
  const onDisconnectSuccess = () => {
    toast.success(t('providerToasts.disconnected', { provider: displayName }));
    queryClient.invalidateQueries({
      queryKey: trpc.integration.getHealth.queryKey({ provider }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.integration.getAllHealth.queryKey(),
    });
    setDisconnectDialogOpen(false);
  };
  const onDisconnectError = () => {
    toast.error(t('providerToasts.disconnectFailed', { provider: displayName }));
  };

  const genericDisconnect = useMutation(
    trpc.integration.disconnectGeneric.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );
  // Provider-specific disconnect procedures perform extra cleanup
  // (Jira: webhook deregistration; KSeF: QStash schedule deletion) that the
  // generic procedure does not. Route by provider so we don't leak side-effect
  // state on disconnect.
  const jiraDisconnect = useMutation(
    trpc.jira.disconnect.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );
  const ksefDisconnect = useMutation(
    trpc.ksef.disconnect.mutationOptions({
      onSuccess: onDisconnectSuccess,
      onError: onDisconnectError,
    }),
  );

  const disconnectMutation =
    provider === 'jira' ? jiraDisconnect : provider === 'ksef' ? ksefDisconnect : genericDisconnect;

  // ---- Connect handler (OAuth) ----
  const oauthUrlQuery = useQuery({
    ...trpc.integration.getOAuthUrlGeneric.queryOptions({ provider }),
    enabled: false,
  });

  async function handleConnect() {
    const result = await oauthUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  // ---- Loading state ----
  if (healthQuery.isLoading) {
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
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button variant="outline" onClick={() => setDetailSheetOpen(true)}>
                  {t('provider.manageCta')}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button variant="outline" onClick={handleConnect}>
                  {t('provider.reconnectCta')}
                </Button>
                {isReauthRequired && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
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
                {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                <Button onClick={handleConnect}>
                  {t('provider.connectCta', { provider: displayName })}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <ProviderDetailSheet
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
              disabled={disconnectMutation.isPending}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (provider === 'jira') {
                  if (!health?.connectionId) return;
                  jiraDisconnect.mutate({ connectionId: health.connectionId });
                } else if (provider === 'ksef') {
                  ksefDisconnect.mutate();
                } else {
                  genericDisconnect.mutate({ provider });
                }
              }}>
              {!!disconnectMutation.isPending && (
                <Loader2 className="me-1.5 size-3.5 animate-spin" />
              )}
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
