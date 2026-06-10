import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Settings, Unlink, Unplug } from 'lucide-react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { PeppolBrandIcon } from '../integrations/brand-icons';
import { useCallback, useState } from 'react';

import { usePeppolStatusCard } from './hooks/use-peppol.js';
import type { PeppolStatusCardProps as StatusCardHookProps } from './hooks/use-peppol.js';
import { PeppolWizard } from './peppol-wizard.js';

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-success/10 text-success border-success/20',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  REGISTERED: {
    label: 'Registered',
    className: 'bg-info/10 text-info border-info/20',
  },
  SUSPENDED: {
    label: 'Suspended',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  DEREGISTERED: {
    label: 'Disconnected',
    className: 'bg-muted text-muted-foreground',
  },
};

// ---------------------------------------------------------------------------
// Skeleton — section-shaped loading state
// ---------------------------------------------------------------------------

export function PeppolStatusCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
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

// ---------------------------------------------------------------------------
// Not-connected variant
// ---------------------------------------------------------------------------

export interface PeppolStatusCardDisconnectedProps {
  onConnectClick: () => void;
}

export function PeppolStatusCardDisconnected({
  onConnectClick,
}: PeppolStatusCardDisconnectedProps) {
  const t = useTranslations('Peppol.statusCard');
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center">
            <PeppolBrandIcon className="size-8" />
          </span>
          <h4 className="text-base font-semibold">{t('title')}</h4>
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            {t('disconnectedBadge')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col space-y-3">
          <p className="text-sm text-muted-foreground">{t('connectDescription')}</p>
          <div className="mt-auto pt-3">
            <Button onClick={onConnectClick}>{t('connect')}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Connected variant
// ---------------------------------------------------------------------------

export type PeppolStatusCardConnectedProps = Pick<
  StatusCardHookProps,
  'participant' | 'connection' | 'counts' | 'onDisconnect' | 'isDisconnecting'
> & {
  participant: NonNullable<StatusCardHookProps['participant']>;
};

export function PeppolStatusCardConnected({
  participant,
  connection,
  counts,
  onDisconnect,
  isDisconnecting,
}: PeppolStatusCardConnectedProps) {
  const t = useTranslations('Peppol.statusCard');
  const statusInfo = STATUS_VARIANTS[participant.status] ?? STATUS_VARIANTS.DEREGISTERED;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center">
            <PeppolBrandIcon className="size-8" />
          </span>
          <h4 className="text-base font-semibold">{t('title')}</h4>
          <Badge variant="outline" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('participantId')}</span>
            <span className="font-mono text-sm">{participant.participantId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('aspProvider')}</span>
            <span className="capitalize">{participant.aspProvider}</span>
          </div>
          {!!connection?.lastSyncAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('lastSync')}</span>
              <span className="text-sm">{new Date(connection.lastSyncAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {!!counts && (
          <div className="flex gap-6 rounded-lg bg-muted/30 p-3">
            <div className="text-center">
              <p className="font-mono text-sm font-medium">{counts.sentTransmissions}</p>
              <p className="text-xs text-muted-foreground">{t('sent')}</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-medium">{counts.receivedTransmissions}</p>
              <p className="text-xs text-muted-foreground">{t('received')}</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-medium text-destructive">
                {counts.failedTransmissions}
              </p>
              <p className="text-xs text-muted-foreground">{t('failed')}</p>
            </div>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="outline" size="sm">
            <Settings className="me-1.5 h-3.5 w-3.5" />
            {t('settings')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Unplug className="me-1.5 h-3.5 w-3.5" />
                  {t('disconnect')}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Unlink className="size-4" />
                  {t('disconnectTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('disconnectDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('disconnectCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDisconnect}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {isDisconnecting ? t('disconnecting') : t('disconnectConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function PeppolStatusCard() {
  const props = usePeppolStatusCard();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleConnectClick = useCallback(() => {
    setWizardOpen(true);
  }, []);

  if (props.isLoading) return <PeppolStatusCardSkeleton />;

  if (!(props.isConnected && props.participant)) {
    return (
      <>
        <PeppolStatusCardDisconnected onConnectClick={handleConnectClick} />
        <PeppolWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </>
    );
  }

  return (
    <PeppolStatusCardConnected
      participant={props.participant}
      connection={props.connection}
      counts={props.counts}
      onDisconnect={props.onDisconnect}
      isDisconnecting={props.isDisconnecting}
    />
  );
}
