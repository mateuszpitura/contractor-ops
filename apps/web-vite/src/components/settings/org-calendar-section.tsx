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
import { Loader2, Unlink } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { GoogleCalendarIcon, OutlookCalendarIcon } from '../integrations/provider-icons';
import { FeatureGate } from '../layout/feature-gate';
import type { CalendarConnection } from './hooks/use-my-calendar-section.js';
import {
  useOrgCalendarProviderCard,
  useOrgCalendarSection,
} from './hooks/use-org-calendar-section.js';

// ---------------------------------------------------------------------------
// OrgCalendarProviderCard
// ---------------------------------------------------------------------------

interface OrgCalendarProviderCardProps {
  displayName: string;
  icon: React.ReactNode;
  connection: CalendarConnection | undefined;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
  isDisconnecting: boolean;
}

function OrgCalendarProviderCard({
  displayName,
  icon,
  connection,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: OrgCalendarProviderCardProps) {
  const t = useTranslations('CalendarSettings');
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const isConnected = connection?.status === 'CONNECTED';

  const handleOpenDisconnect = useCallback(() => setDisconnectDialogOpen(true), []);
  const handleConfirmDisconnect = useCallback(() => {
    if (connection) {
      onDisconnect(connection.id);
      setDisconnectDialogOpen(false);
    }
  }, [connection, onDisconnect]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center">{icon}</span>
            <h4 className="text-base font-semibold">{displayName}</h4>
            <Badge
              variant="secondary"
              className={
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-muted text-muted-foreground'
              }>
              {isConnected ? t('statusConnected') : t('statusNotConnected')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('orgCalendarDescription')}</p>
              <div className="space-y-1 text-sm">
                {!!connection.displayName && (
                  <p>
                    <span className="text-muted-foreground">{t('connectedAccount')}:</span>{' '}
                    <span className="font-medium">{connection.displayName}</span>
                  </p>
                )}
                {!!connection.connectedAt && (
                  <p>
                    <span className="text-muted-foreground">{t('connectedOn')}:</span>{' '}
                    <span className="font-medium">
                      {new Date(connection.connectedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleOpenDisconnect}>
                {t('disconnectCalendar')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('orgCalendarDescription')}</p>
              <Button onClick={onConnect}>{t('connectCalendar')}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink className="size-4" />
              {t('disconnectTitle', { provider: displayName })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('disconnectBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepConnection')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDisconnecting}
              onClick={handleConfirmDisconnect}>
              {!!isDisconnecting && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t('disconnectCalendar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// OrgCalendarSection
// ---------------------------------------------------------------------------

export type OrgCalendarSectionProps = ReturnType<typeof useOrgCalendarSection> & {
  onGoogleConnect: () => void;
  onOutlookConnect: () => void;
};

export function OrgCalendarSection() {
  const section = useOrgCalendarSection();
  const google = useOrgCalendarProviderCard('google-calendar');
  const outlook = useOrgCalendarProviderCard('outlook-calendar');

  if (section.isLoading) return <OrgCalendarSectionSkeleton t={section.t} />;
  return (
    <OrgCalendarSectionView
      {...section}
      onGoogleConnect={google.handleConnect}
      onOutlookConnect={outlook.handleConnect}
    />
  );
}

export function OrgCalendarSectionSkeleton({ t }: { t: OrgCalendarSectionProps['t'] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t('calendarSectionTitle')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-8 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-8 w-32" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OrgCalendarSectionView({
  t,
  googleConnection,
  outlookConnection,
  handleDisconnect,
  isDisconnecting,
  onGoogleConnect,
  onOutlookConnect,
}: OrgCalendarSectionProps) {
  return (
    <FeatureGate requiredTier="Pro" featureName="Calendar integration">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">{t('calendarSectionTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OrgCalendarProviderCard
            displayName={t('googleCalendar')}
            icon={<GoogleCalendarIcon className="h-8 w-8" />}
            connection={googleConnection}
            onConnect={onGoogleConnect}
            onDisconnect={handleDisconnect}
            isDisconnecting={isDisconnecting}
          />
          <OrgCalendarProviderCard
            displayName={t('outlookCalendar')}
            icon={<OutlookCalendarIcon className="h-8 w-8 text-[#0078D4]" />}
            connection={outlookConnection}
            onConnect={onOutlookConnect}
            onDisconnect={handleDisconnect}
            isDisconnecting={isDisconnecting}
          />
        </div>
      </div>
    </FeatureGate>
  );
}
