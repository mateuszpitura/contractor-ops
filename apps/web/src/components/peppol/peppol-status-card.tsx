'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Settings, Unplug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/trpc/init';
import { PeppolWizard } from './peppol-wizard';

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
// Component
// ---------------------------------------------------------------------------

export function PeppolStatusCard() {
  const t = useTranslations('Peppol.statusCard');
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const statusQuery = useQuery(trpc.peppol.getStatus.queryOptions());
  const participantQuery = useQuery(trpc.peppol.getParticipant.queryOptions());

  const disconnectMutation = useMutation(
    trpc.peppol.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.disconnected'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getParticipant.queryKey(),
        });
      },
      onError: error => {
        toast.error(error.message || t('toast.disconnectError'));
      },
    }),
  );

  // Not connected state
  if (!statusQuery.data) {
    return (
      <>
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-muted p-2.5">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-semibold">{t('title')}</h3>
              <p className="text-sm text-muted-foreground">{t('notConnected')}</p>
              <p className="text-sm text-muted-foreground">{t('connectDescription')}</p>
            </div>
            <Button onClick={() => setWizardOpen(true)}>{t('connect')}</Button>
          </div>
        </Card>
        <PeppolWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </>
    );
  }

  const { participant, connection } = statusQuery.data;
  const statusInfo = STATUS_VARIANTS[participant.status] ?? STATUS_VARIANTS.DEREGISTERED!;
  const counts = participantQuery.data?._count;

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
          </div>
          <Badge variant="outline" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('participantId')}</span>
            <span className="font-mono text-sm">{participant.participantId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('aspProvider')}</span>
            <span className="capitalize">{participant.aspProvider}</span>
          </div>
          {connection?.lastSyncAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('lastSync')}</span>
              <span className="text-sm">{new Date(connection.lastSyncAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Metrics */}
        {counts && (
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
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
                <AlertDialogTitle>{t('disconnectTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('disconnectDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('disconnectCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => disconnectMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {disconnectMutation.isPending ? t('disconnecting') : t('disconnectConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
