'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { trpc } from '@/trpc/init';

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

interface PeppolTransmissionStatusProps {
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
        {timestamp && (
          <p className="font-mono text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeppolTransmissionStatus({ transmission }: PeppolTransmissionStatusProps) {
  const t = useTranslations('Peppol.transmission');
  const queryClient = useQueryClient();

  const retryMutation = useMutation(
    trpc.peppol.retryTransmission.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retryQueued'));
        queryClient.invalidateQueries({
          queryKey: trpc.peppol.getTransmissions.queryKey(),
        });
      },
      onError: error => {
        toast.error(error.message || t('toast.retryFailed'));
      },
    }),
  );

  const statusInfo = TX_STATUS[transmission.status] ?? TX_STATUS.PENDING!;
  const isFailed = transmission.status === 'FAILED' || transmission.status === 'REJECTED';

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
            {/* Timeline */}
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

            {/* Error message */}
            {isFailed && transmission.errorMessage && (
              <p className="text-sm text-destructive">{transmission.errorMessage}</p>
            )}

            {/* ASP Reference */}
            {transmission.aspTransmissionId && (
              <p className="font-mono text-xs text-muted-foreground">
                {t('aspRef')} {transmission.aspTransmissionId}
              </p>
            )}

            {/* Retry button */}
            {isFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  retryMutation.mutate({
                    transmissionId: transmission.id,
                  })
                }
                disabled={retryMutation.isPending}>
                <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                {retryMutation.isPending ? t('retrying') : t('retryTransmission')}
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
