import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardTitle } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePeppolTransmissionStatus } from './hooks/use-peppol.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeppolTransmission {
  id: string;
  status: string;
  aspTransmissionId: string | null;
  transmittedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

export interface PeppolTransmissionStatusProps {
  transmission: PeppolTransmission;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const TX_STATUS: Record<string, { label: string; className: string }> = {
  DELIVERED: {
    label: 'Delivered',
    className: 'bg-success/10 text-success border-success/20',
  },
  TRANSMITTED: {
    label: 'Transmitted',
    className: 'bg-info/10 text-info border-info/20',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

// ---------------------------------------------------------------------------
// Timeline step
// ---------------------------------------------------------------------------

function TimelineStep({
  label,
  timestamp,
  done,
}: {
  label: string;
  timestamp: string | null;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1 h-2.5 w-2.5 rounded-full ${
          done ? 'bg-success' : 'bg-muted-foreground/30'
        }`}
      />
      <div className="flex-1">
        <p className="text-sm">{label}</p>
        {!!timestamp && (
          <p className="font-mono text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

interface PeppolTransmissionCardShellProps {
  transmission: PeppolTransmission;
  extras?: ReactNode;
}

function PeppolTransmissionCardShell({ transmission, extras }: PeppolTransmissionCardShellProps) {
  const t = useTranslations('Peppol.transmission');
  const statusInfo = TX_STATUS[transmission.status] ?? TX_STATUS.PENDING;

  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between p-4">
          <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
          <Badge variant="outline" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 px-4 pb-4 pt-0">
            <div className="space-y-3">
              <TimelineStep label={t('created')} timestamp={transmission.createdAt} done={true} />
              <TimelineStep
                label={t('transmitted')}
                timestamp={transmission.transmittedAt}
                done={transmission.status === 'TRANSMITTED' || transmission.status === 'DELIVERED'}
              />
              <TimelineStep
                label={t('delivered')}
                timestamp={transmission.deliveredAt}
                done={transmission.status === 'DELIVERED'}
              />
            </div>

            {!!transmission.aspTransmissionId && (
              <p className="font-mono text-xs text-muted-foreground">
                {t('aspRef')} {transmission.aspTransmissionId}
              </p>
            )}

            {extras}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Success / pending variant — no error block, no retry control
// ---------------------------------------------------------------------------

export function PeppolTransmissionTimeline({ transmission }: PeppolTransmissionStatusProps) {
  return <PeppolTransmissionCardShell transmission={transmission} />;
}

// ---------------------------------------------------------------------------
// Failed variant — adds error message + retry control
// ---------------------------------------------------------------------------

export interface PeppolTransmissionTimelineFailedProps extends PeppolTransmissionStatusProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function PeppolTransmissionTimelineFailed({
  transmission,
  onRetry,
  isRetrying,
}: PeppolTransmissionTimelineFailedProps) {
  const t = useTranslations('Peppol.transmission');

  return (
    <PeppolTransmissionCardShell
      transmission={transmission}
      extras={
        <>
          {!!transmission.errorMessage && (
            <p className="text-sm text-destructive">{transmission.errorMessage}</p>
          )}
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {isRetrying ? t('retrying') : t('retryTransmission')}
          </Button>
        </>
      }
    />
  );
}

export function PeppolTransmissionStatus({ transmission }: PeppolTransmissionStatusProps) {
  const tx = usePeppolTransmissionStatus({
    transmissionId: transmission.id,
    status: transmission.status,
  });

  if (tx.isFailed) {
    return (
      <PeppolTransmissionTimelineFailed
        transmission={transmission}
        onRetry={tx.onRetry}
        isRetrying={tx.isRetrying}
      />
    );
  }

  return <PeppolTransmissionTimeline transmission={transmission} />;
}
